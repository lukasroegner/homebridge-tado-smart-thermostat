/**
 * Represents a hot water zone in Tado.
 * @param platform The TadoPlatform instance.
 * @param apiZone The zone from the API.
 */
function TadoHotWaterZone(platform, apiZone) {
    const zone = this;
    const { UUIDGen, Accessory, Characteristic, Service } = platform;

    // Sets the ID and platform
    zone.id = apiZone.id;
    zone.platform = platform;

    // Gets all accessories from the platform that match the zone ID
    let unusedZoneAccessories = platform.accessories.filter(function(a) { return a.context.id === zone.id; });
    let newZoneAccessories = [];
    let zoneAccessories = [];

    // Gets the thermostat accessory
    let hotWaterAccessory = unusedZoneAccessories.find(function(a) { return a.context.kind === 'HotWaterAccessory'; });
    if (hotWaterAccessory) {
        unusedZoneAccessories.splice(unusedZoneAccessories.indexOf(hotWaterAccessory), 1);
    } else {
        platform.log('Adding new accessory with zone ID ' + zone.id + ' and kind HotWaterAccessory.');
        hotWaterAccessory = new Accessory(apiZone.name, UUIDGen.generate(zone.id + 'HotWaterAccessory'));
        hotWaterAccessory.context.id = zone.id;
        hotWaterAccessory.context.kind = 'HotWaterAccessory';
        newZoneAccessories.push(hotWaterAccessory);
    }
    zoneAccessories.push(hotWaterAccessory);

    // Registers the newly created accessories
    platform.api.registerPlatformAccessories(platform.pluginName, platform.platformName, newZoneAccessories);

    // Removes all unused accessories
    for (let i = 0; i < unusedZoneAccessories.length; i++) {
        const unusedZoneAccessory = unusedZoneAccessories[i];
        platform.log('Removing unused accessory with zone ID ' + unusedZoneAccessory.context.id + ' and kind ' + unusedZoneAccessory.context.kind + '.');
        platform.accessories.splice(platform.accessories.indexOf(unusedZoneAccessory), 1);
    }
    platform.api.unregisterPlatformAccessories(platform.pluginName, platform.platformName, unusedZoneAccessories);

    // Gets the zone leader
    const zoneLeader = apiZone.devices.find(function(d) { return d.duties.some(function(duty) { return duty === 'ZONE_LEADER'; }); });
    if (!zoneLeader) {
        zoneLeader = apiZone.devices[0];
    }

    // Updates the accessory information
    for (let i = 0; i < zoneAccessories.length; i++) {
        const zoneAccessory = zoneAccessories[i];
        let accessoryInformationService = zoneAccessory.getService(Service.AccessoryInformation);
        if (!accessoryInformationService) {
            accessoryInformationService = zoneAccessory.addService(Service.AccessoryInformation);
        }
        accessoryInformationService
            .setCharacteristic(Characteristic.Manufacturer, 'Tado')
            .setCharacteristic(Characteristic.Model, zoneLeader.deviceType)
            .setCharacteristic(Characteristic.SerialNumber, zoneLeader.serialNo)
            .setCharacteristic(Characteristic.FirmwareRevision, zoneLeader.currentFwVersion);
    }

    // Updates the hot water service
    let hotWaterService = hotWaterAccessory.getServiceByUUIDAndSubType(Service.Switch);
    if (!hotWaterService) {
        hotWaterService = hotWaterAccessory.addService(Service.Switch);
    }

    // Stores the hot water service
    zone.hotWaterService = hotWaterService;
    
    // Sets termination variable from zone config
    let terminationOption;
    for (let i = 0; i < platform.config.zones.length; i++) {
        if (platform.config.zones[i].zoneId == zone.id) {
            terminationOption = platform.config.zones[i].terminationOption;
            break;
        }
    }
    let termination = 'manual';
    if (terminationOption == null && platform.config.switchToAutoInNextTimeBlock) {
        termination =  'auto';
    } else if (!isNaN(parseInt(terminationOption))) {
        termination = terminationOption * 60;
    } else {
        termination = terminationOption;
    }

    // Subscribes for changes of the target state characteristic
    hotWaterService.getCharacteristic(Characteristic.On).on('set', function (value, callback) {
        // Sets the state to ON
        if (value === true) {
            platform.log.debug(zone.id + ' - Switch target state to HEATING');
            zone.platform.client.setZoneOverlay(platform.home.id, zone.id, 'on', hotWaterService.getCharacteristic(Characteristic.On).value, termination).then(function() {
                // Updates the state
                zone.updateState();
            }, function() {
                platform.log(zone.id + ' - Failed to switch target state to ON');
            });
        }

        // Sets the state to OFF
        if (value === false) {
            platform.log.debug(zone.id + ' - Switch target state to AUTO');
            zone.platform.client.clearZoneOverlay(platform.home.id, zone.id).then(function() {
                // Updates the state
                zone.updateState();
            }, function() {
                platform.log(zone.id + ' - Failed to switch target state to OFF');
            });
        }

        // Performs the callback
        callback(null);
    });

    // Sets the interval for the next update
    setInterval(function() { zone.updateState(); }, zone.platform.config.stateUpdateInterval * 1000);

    // Updates the state initially
    zone.updateState();
}

/**
 * Can be called to update the zone state.
 */
TadoHotWaterZone.prototype.updateState = function () {
    const zone = this;
    const { Characteristic } = zone.platform;

    // Calls the API to update the state
    zone.platform.client.getZoneState(zone.platform.home.id, zone.id).then(function(state) {
        const apiZone = zone.platform.apiZones.find(function(z) { return z.id === zone.id; });
        apiZone.state = state;

        // Updates the target state
        zone.hotWaterService.updateCharacteristic(Characteristic.On, state.setting.power === 'ON');
        
        zone.platform.log.debug(zone.id + ' - Updated state.');
        zone.platform.log.debug(zone.id + ' - new state: ' + JSON.stringify(state));
    }, function() {
        zone.platform.log(zone.id + ' - Error getting state from API.');
    });
}

/**
  * Can be called to update the zone. Not needed for hot water.
  */
TadoHotWaterZone.prototype.updateZone = function (apiZones) { }

/**
 * Defines the export of the file.
 */
module.exports = TadoHotWaterZone;
