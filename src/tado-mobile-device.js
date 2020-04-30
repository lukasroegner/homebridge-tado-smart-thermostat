
/**
 * Represents a mobile device with geo-fence feature in Tado.
 * @param platform The TadoPlatform instance.
 * @param apiMobileDevice The mobile device from the API.
 */
function TadoMobileDevice(platform, apiMobileDevice) {
    const mobileDevice = this;
    const { UUIDGen, Accessory, Characteristic, Service } = platform;

    // Sets the ID and platform
    mobileDevice.id = apiMobileDevice.id;
    mobileDevice.platform = platform;

    // Gets all accessories from the platform that match the mobile device ID
    let unusedMobileDeviceAccessories = platform.accessories.filter(function(a) { return a.context.id === mobileDevice.id; });
    let newMobileDeviceAccessories = [];
    let mobileDeviceAccessories = [];

    // Gets the occupancy accessory
    let occupancyAccessory = unusedMobileDeviceAccessories.find(function(a) { return a.context.kind === 'OccupancyAccessory'; });
    if (occupancyAccessory) {
        unusedMobileDeviceAccessories.splice(unusedMobileDeviceAccessories.indexOf(occupancyAccessory), 1);
    } else {
        platform.log('Adding new accessory with mobile device ID ' + mobileDevice.id + ' and kind OccupancyAccessory.');
        occupancyAccessory = new Accessory(apiMobileDevice.name, UUIDGen.generate(mobileDevice.id + 'OccupancyAccessory'));
        occupancyAccessory.context.id = mobileDevice.id;
        occupancyAccessory.context.kind = 'OccupancyAccessory';
        newMobileDeviceAccessories.push(occupancyAccessory);
    }
    mobileDeviceAccessories.push(occupancyAccessory);

    // Registers the newly created accessories
    platform.api.registerPlatformAccessories(platform.pluginName, platform.platformName, newMobileDeviceAccessories);

    // Removes all unused accessories
    for (let i = 0; i < unusedMobileDeviceAccessories.length; i++) {
        const unusedMobileDeviceAccessory = unusedMobileDeviceAccessories[i];
        platform.log('Removing unused accessory with mobile device ID ' + unusedMobileDeviceAccessory.context.id + ' and kind ' + unusedMobileDeviceAccessory.context.kind + '.');
        platform.accessories.splice(platform.accessories.indexOf(unusedMobileDeviceAccessory), 1);
    }
    platform.api.unregisterPlatformAccessories(platform.pluginName, platform.platformName, unusedMobileDeviceAccessories);

    // Gets the device data
    let manufacturer = 'Tado';
    let model = 'Mobile Device';
    let firmwareRevision = '1';
    if (apiMobileDevice.deviceMetadata) {
        if (apiMobileDevice.deviceMetadata.platform) {
            manufacturer = apiMobileDevice.deviceMetadata.platform;
        }
        if (apiMobileDevice.deviceMetadata.model) {
            model = apiMobileDevice.deviceMetadata.model;
        }
        if (apiMobileDevice.deviceMetadata.osVersion) {
            firmwareRevision = apiMobileDevice.deviceMetadata.osVersion;
        }
    }

    // Updates the accessory information
    for (let i = 0; i < mobileDeviceAccessories.length; i++) {
        const mobileDeviceAccessory = mobileDeviceAccessories[i];
        let accessoryInformationService = mobileDeviceAccessory.getService(Service.AccessoryInformation);
        if (!accessoryInformationService) {
            accessoryInformationService = mobileDeviceAccessory.addService(Service.AccessoryInformation);
        }
        accessoryInformationService
            .setCharacteristic(Characteristic.Manufacturer, manufacturer)
            .setCharacteristic(Characteristic.Model, model)
            .setCharacteristic(Characteristic.SerialNumber, apiMobileDevice.id)
            .setCharacteristic(Characteristic.FirmwareRevision, firmwareRevision);
    }

    // Updates the occupancy sensor service
    let occupancyService = occupancyAccessory.getServiceByUUIDAndSubType(Service.OccupancySensor);
    if (!occupancyService) {
        occupancyService = occupancyAccessory.addService(Service.OccupancySensor);
    }

    // Stores the thermostat service
    mobileDevice.occupancyService = occupancyService;
}

/**
 * Can be called to update the mobile devices.
 */
TadoMobileDevice.prototype.updateMobileDevice = function (apiMobileDevices) {
    const mobileDevice = this;
    const { Characteristic } = mobileDevice.platform;

    // Gets the mobile device that this instance represents
    const apiMobileDevice = apiMobileDevices.find(function(m) { return m.id === mobileDevice.id; });
    if (apiMobileDevice) {
        let atHome = 0;
        if (apiMobileDevice.location && apiMobileDevice.location.atHome) {
            atHome = 1;
        }
        mobileDevice.occupancyService.updateCharacteristic(Characteristic.OccupancyDetected, atHome);
    }
}

/**
 * Defines the export of the file.
 */
module.exports = TadoMobileDevice;
