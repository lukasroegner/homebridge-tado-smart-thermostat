
/**
 * Represents a home device with security system for Home/Away.
 * @param platform The TadoPlatform instance.
 * @param apiHome The home object from the API.
 */
function TadoHomeDevice(platform, apiHome) {
    const homeDevice = this;
    const { UUIDGen, Accessory, Characteristic, Service } = platform;

    // Sets the ID and platform
    homeDevice.id = apiHome.id;
    homeDevice.platform = platform;

    // Gets all accessories from the platform that match the home ID
    let unusedHomeDeviceAccessories = platform.accessories.filter(function(a) { return a.context.id === homeDevice.id; });
    let newHomeDeviceAccessories = [];
    let homeDeviceAccessories = [];

    // Gets the security system accessory
    let securitySystemAccessory = unusedHomeDeviceAccessories.find(function(a) { return a.context.kind === 'SecuritySystemAccessory'; });
    if (securitySystemAccessory) {
        unusedHomeDeviceAccessories.splice(unusedHomeDeviceAccessories.indexOf(securitySystemAccessory), 1);
    } else {
        platform.log('Adding new accessory with home device ID ' + homeDevice.id + ' and kind SecuritySystemAccessory.');
        securitySystemAccessory = new Accessory('Home', UUIDGen.generate(homeDevice.id + 'SecuritySystemAccessory'));
        securitySystemAccessory.context.id = homeDevice.id;
        securitySystemAccessory.context.kind = 'SecuritySystemAccessory';
        newHomeDeviceAccessories.push(securitySystemAccessory);
    }
    homeDeviceAccessories.push(securitySystemAccessory);

    // Registers the newly created accessories
    platform.api.registerPlatformAccessories(platform.pluginName, platform.platformName, newHomeDeviceAccessories);

    // Removes all unused accessories
    for (let i = 0; i < unusedHomeDeviceAccessories.length; i++) {
        const unusedHomeDeviceAccessory = unusedHomeDeviceAccessories[i];
        platform.log('Removing unused accessory with home device ID ' + unusedHomeDeviceAccessory.context.id + ' and kind ' + unusedHomeDeviceAccessory.context.kind + '.');
        platform.accessories.splice(platform.accessories.indexOf(unusedHomeDeviceAccessory), 1);
    }
    platform.api.unregisterPlatformAccessories(platform.pluginName, platform.platformName, unusedHomeDeviceAccessories);

    // Updates the accessory information
    for (let i = 0; i < homeDeviceAccessories.length; i++) {
        const homeDeviceAccessory = homeDeviceAccessories[i];
        let accessoryInformationService = homeDeviceAccessory.getService(Service.AccessoryInformation);
        if (!accessoryInformationService) {
            accessoryInformationService = homeDeviceAccessory.addService(Service.AccessoryInformation);
        }
        accessoryInformationService
            .setCharacteristic(Characteristic.Manufacturer, 'Tado')
            .setCharacteristic(Characteristic.Model, 'Home')
            .setCharacteristic(Characteristic.SerialNumber, apiHome.id)
            .setCharacteristic(Characteristic.FirmwareRevision, '1');
    }

    // Updates the occupancy sensor service
    let occupancyService = securitySystemAccessory.getServiceByUUIDAndSubType(Service.OccupancySensor);
    if (!occupancyService) {
        occupancyService = securitySystemAccessory.addService(Service.OccupancySensor);
    }

    // Stores the occupancy service
    homeDevice.occupancyService = occupancyService;

    // Updates the security system service
    let securitySystemService = securitySystemAccessory.getServiceByUUIDAndSubType(Service.SecuritySystem);
    if (!securitySystemService) {
        securitySystemService = securitySystemAccessory.addService(Service.SecuritySystem);
    }

    // Disables night mode
    securitySystemService.getCharacteristic(Characteristic.SecuritySystemCurrentState).setProps({
        maxValue: 3,
        minValue: 0,
        validValues: [0, 1, 3]
    });
    securitySystemService.getCharacteristic(Characteristic.SecuritySystemTargetState).setProps({
        maxValue: 3,
        minValue: 0,
        validValues: [0, 1, 3]
    });
    securitySystemService.updateCharacteristic(Characteristic.SecuritySystemCurrentState, 3);
    securitySystemService.updateCharacteristic(Characteristic.SecuritySystemTargetState, 3);

    // Stores the security system service
    homeDevice.securitySystemService = securitySystemService;

    // Subscribes for changes of the security system
    securitySystemService.getCharacteristic(Characteristic.SecuritySystemTargetState).on('set', function (value, callback) {

        // Sets the presence
        if (value == 0) {
            platform.log.debug(homeDevice.id + ' - Set presence to HOME');
            homeDevice.platform.client.setPresence(platform.home.id, 'HOME').then(function() {

                // Updates the state
                homeDevice.updateState();
            }, function() {
                platform.log(homeDevice.id + ' - Failed to set presence to HOME');
            });
        }
        if (value == 1) {
            platform.log.debug(homeDevice.id + ' - Set presence to AWAY');
            homeDevice.platform.client.setPresence(platform.home.id, 'AWAY').then(function() {
                
                // Updates the state
                homeDevice.updateState();
            }, function() {
                platform.log(homeDevice.id + ' - Failed to set presence to AWAY');
            });
        }
        if (value == 3) {
            platform.log.debug(homeDevice.id + ' - Set presence to AUTO');
            homeDevice.platform.client.setPresence(platform.home.id, 'AUTO').then(function() {
                
                // Updates the state
                homeDevice.updateState();
            }, function() {
                platform.log(homeDevice.id + ' - Failed to set presence to AUTO');
            });
        }

        // Performs the callback
        callback(null);
    });
}

/**
 * Can be called to update the home state.
 */
TadoHomeDevice.prototype.updateState = function () {
    const homeDevice = this;

    // Calls the API to update the state
    homeDevice.platform.client.getState(homeDevice.id).then(function(state) {
            
        // Updates the Home/Away security system
        homeDevice.updateHomeDevice(state);
        homeDevice.platform.log.debug(homeDevice.id + ' - Updated state.');
    }, function() {
        homeDevice.platform.log(homeDevice.id + ' - Error getting state from API.');
    });
}

/**
 * Can be called to update the home.
 */
TadoHomeDevice.prototype.updateHomeDevice = function (state) {
    const homeDevice = this;
    const { Characteristic } = homeDevice.platform;

    // Updates the Home/Away security system
    if (!state.presenceLocked) {
        homeDevice.securitySystemService.updateCharacteristic(Characteristic.SecuritySystemCurrentState, 3);
        homeDevice.securitySystemService.updateCharacteristic(Characteristic.SecuritySystemTargetState, 3);
    } else if (state.presence === 'HOME') {
        homeDevice.securitySystemService.updateCharacteristic(Characteristic.SecuritySystemCurrentState, 0);
        homeDevice.securitySystemService.updateCharacteristic(Characteristic.SecuritySystemTargetState, 0);
    } else if (state.presence === 'AWAY') {
        homeDevice.securitySystemService.updateCharacteristic(Characteristic.SecuritySystemCurrentState, 1);
        homeDevice.securitySystemService.updateCharacteristic(Characteristic.SecuritySystemTargetState, 1);
    }

    // Updates the occupancy sensor
    homeDevice.occupancyService.updateCharacteristic(Characteristic.OccupancyDetected, state.presence === 'HOME' ? 1 : 0);
}

/**
 * Defines the export of the file.
 */
module.exports = TadoHomeDevice;
