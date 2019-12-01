
/**
 * Represents a heating zone in Tado.
 * @param platform The TadoPlatform instance.
 * @param apiZone The zone from the API.
 */
function TadoHeatingZone(platform, apiZone) {
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
    let thermostatAccessory = unusedZoneAccessories.find(function(a) { return a.context.kind === 'ThermostatAccessory'; });
    if (thermostatAccessory) {
        unusedZoneAccessories.splice(unusedZoneAccessories.indexOf(thermostatAccessory), 1);
    } else {
        platform.log('Adding new accessory with zone ID ' + zone.id + ' and kind ThermostatAccessory.');
        thermostatAccessory = new Accessory(apiZone.name, UUIDGen.generate(zone.id + 'ThermostatAccessory'));
        thermostatAccessory.context.id = zone.id;
        thermostatAccessory.context.kind = 'ThermostatAccessory';
        newZoneAccessories.push(thermostatAccessory);
    }
    zoneAccessories.push(thermostatAccessory);

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

    // Updates the thermostat service
    let thermostatService = thermostatAccessory.getServiceByUUIDAndSubType(Service.Thermostat);
    if (!thermostatService) {
        thermostatService = thermostatAccessory.addService(Service.Thermostat);
    }

    // Disables cooling
    thermostatService.getCharacteristic(Characteristic.CurrentHeatingCoolingState).setProps({
        maxValue: 1,
        minValue: 0,
        validValues: [0, 1]
    });
    thermostatService.getCharacteristic(Characteristic.TargetHeatingCoolingState).setProps({
        maxValue: 3,
        minValue: 0,
        validValues: [0, 1, 3]
    });
    thermostatService.getCharacteristic(Characteristic.TargetTemperature).setProps({
        maxValue: 25,
        minValue: 5,
        minStep: 0.1
      });

    // Stores the thermostat service
    zone.thermostatService = thermostatService;

    // Updates the humidity sensor service
    let humiditySensorService = thermostatAccessory.getServiceByUUIDAndSubType(Service.HumiditySensor);
    if (!humiditySensorService) {
        humiditySensorService = thermostatAccessory.addService(Service.HumiditySensor);
    }

    // Stores the humidity sensor service
    zone.humiditySensorService = humiditySensorService;

    // Updates the contact snesor service
    let contactSensorService = thermostatAccessory.getServiceByUUIDAndSubType(Service.ContactSensor);
    if (apiZone.openWindowDetection && apiZone.openWindowDetection.supported && apiZone.openWindowDetection.enabled) {
        if (!contactSensorService) {
            contactSensorService = thermostatAccessory.addService(Service.ContactSensor);
        }
    } else {
        if (contactSensorService) {
            thermostatAccessory.removeService(contactSensorService);
            contactSensorService = null;
        }
    }

    // Stores the contact sensor service
    zone.contactSensorService = contactSensorService;

    // Subscribes for changes of the target state characteristic
    thermostatService.getCharacteristic(Characteristic.TargetHeatingCoolingState).on('set', function (value, callback) {

        // Sets the state to OFF
        if (!value) {
            platform.log.debug(zone.id + ' - Switch target state to OFF');
            zone.platform.client.setZoneOverlay(platform.home.id, zone.id, 'off', thermostatService.getCharacteristic(Characteristic.TargetTemperature).value, platform.config.switchToAutoInNextTimeBlock ? 'auto' : 'manual').then(function() {

                // Updates the state
                zone.updateState();
            }, function() {
                platform.log(device.uniqueId + ' - Failed to switch target state to OFF');
            });
        }

        // Sets the state to HEATING
        if (value === 1) {
            platform.log.debug(zone.id + ' - Switch target state to HEATING');
            zone.platform.client.setZoneOverlay(platform.home.id, zone.id, 'on', thermostatService.getCharacteristic(Characteristic.TargetTemperature).value, platform.config.switchToAutoInNextTimeBlock ? 'auto' : 'manual').then(function() {

                // Updates the state
                zone.updateState();
            }, function() {
                platform.log(device.uniqueId + ' - Failed to switch target state to HEATING');
            });
        }

        // Sets the state to AUTO
        if (value === 3) {
            platform.log.debug(zone.id + ' - Switch target state to AUTO');
            zone.platform.client.clearZoneOverlay(platform.home.id, zone.id).then(function() {

                // Updates the state
                zone.updateState();
            }, function() {
                platform.log(device.uniqueId + ' - Failed to switch target state to AUTO');
            });
        }

        // Performs the callback
        callback(null);
    });

    // Subscribes for changes of the target temperature characteristic
    thermostatService.getCharacteristic(Characteristic.TargetTemperature).on('set', function (value, callback) {

        // Sets the target temperature
        platform.log.debug(zone.id + ' - Set target temperature to ' + value);
        zone.platform.client.setZoneOverlay(platform.home.id, zone.id, 'on', value, platform.config.switchToAutoInNextTimeBlock ? 'auto' : 'manual').then(function() {

            // Updates the state
            zone.updateState();
        }, function() {
            platform.log(device.uniqueId + ' - Failed to set target temperature to ' + value);
        });

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
TadoHeatingZone.prototype.updateState = function () {
    const zone = this;
    const { Characteristic } = zone.platform;

    // Calls the API to update the state
    zone.platform.client.getZoneState(zone.platform.home.id, zone.id).then(function(state) {

        // Updates the current states
        zone.thermostatService.updateCharacteristic(Characteristic.CurrentHeatingCoolingState, state.setting.power === 'ON' && state.setting.temperature && state.sensorDataPoints.insideTemperature.celsius < state.setting.temperature.celsius ? 1 : 0);
        zone.thermostatService.updateCharacteristic(Characteristic.TargetHeatingCoolingState, !state.overlayType ? 3 : (state.setting.power === 'ON' ? 1 : 0));
        
        // Updates the temperatures
        zone.thermostatService.updateCharacteristic(Characteristic.CurrentTemperature, state.sensorDataPoints.insideTemperature.celsius);
        if (state.setting.temperature) {
            zone.thermostatService.updateCharacteristic(Characteristic.TargetTemperature, state.setting.temperature.celsius);
        }

        // Updates the humidity
        zone.humiditySensorService.updateCharacteristic(Characteristic.CurrentRelativeHumidity, state.sensorDataPoints.humidity.percentage);

        // Updates the contact sensor
        if (zone.contactSensorService) {
            zone.contactSensorService.updateCharacteristic(Characteristic.ContactSensorState, !!state.openWindow);
        }
        zone.platform.log.debug(zone.id + ' - Updated state.');
    }, function() {
        zone.platform.log(zone.id + ' - Error getting state from API.');
    });
}

/**
 * Can be called to update the zone.
 */
TadoHeatingZone.prototype.updateZone = function (apiZones) {
    const zone = this;
    const { Characteristic } = zone.platform;

    // Gets the light that is used in this light bulb device
    const apiZone = apiZones.find(function(z) { return z.id === zone.id; });

    // Updates the battery state
    zone.thermostatService.updateCharacteristic(Characteristic.StatusLowBattery, apiZone.devices.some(function(d) { return d.batteryState !== 'NORMAL'; }));
}

/**
 * Defines the export of the file.
 */
module.exports = TadoHeatingZone;
