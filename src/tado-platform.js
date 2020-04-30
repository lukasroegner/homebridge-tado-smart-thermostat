
const Tado = require('node-tado-client');

const TadoHeatingZone = require('./tado-heating-zone');
const TadoMobileDevice = require('./tado-mobile-device');
const TadoApi = require('./tado-api');

/**
 * Initializes a new platform instance for the Tado plugin.
 * @param log The logging function.
 * @param config The configuration that is passed to the plugin (from the config.json file).
 * @param api The API instance of homebridge (may be null on older homebridge versions).
 */
function TadoPlatform(log, config, api) {
    const platform = this;

    // Saves objects for functions
    platform.Accessory = api.platformAccessory;
    platform.Categories = api.hap.Accessory.Categories;
    platform.Service = api.hap.Service;
    platform.Characteristic = api.hap.Characteristic;
    platform.UUIDGen = api.hap.uuid;
    platform.hap = api.hap;
    platform.pluginName = 'homebridge-tado';
    platform.platformName = 'TadoPlatform';

    // Checks whether a configuration is provided, otherwise the plugin should not be initialized
    if (!config) {
        return;
    }

    // Defines the variables that are used throughout the platform
    platform.log = log;
    platform.config = config;
    platform.zones = [];
    platform.apiZones = [];
    platform.mobileDevices = [];
    platform.apiMobileDevices = [];
    platform.accessories = [];

    // Initializes the configuration
    platform.config.username = platform.config.username || null;
    platform.config.password = platform.config.password || null;
    platform.config.homeName = platform.config.homeName || null;
    platform.config.switchToAutoInNextTimeBlock = platform.config.switchToAutoInNextTimeBlock || false;
    platform.config.zoneUpdateInterval = platform.config.zoneUpdateInterval || 3600;
    platform.config.stateUpdateInterval = platform.config.stateUpdateInterval || 60;
    platform.config.occupancyUpdateInterval = platform.config.occupancyUpdateInterval || 60;
    platform.config.isApiEnabled = platform.config.isApiEnabled || false;
    platform.config.apiPort = platform.config.apiPort || 40810;
    platform.config.apiToken = platform.config.apiToken || null;

    // Checks whether the API object is available
    if (!api) {
        platform.log('Homebridge API not available, please update your homebridge version!');
        return;
    }

    // Saves the API object to register new devices later on
    platform.log('Homebridge API available.');
    platform.api = api;

    // Checks if all required information is provided
    if (!platform.config.username || !platform.config.password || !platform.config.homeName) {
        platform.log('No username, password or home name provided.');
        return;
    }

    // Initializes the client
    platform.client = new Tado();
    
    // Subscribes to the event that is raised when homebridge finished loading cached accessories
    platform.api.on('didFinishLaunching', function () {
        platform.log('Cached accessories loaded.');

        // Performs the login
        platform.client.login(platform.config.username, platform.config.password).then(function () {
            platform.client.getMe().then(function (me) {
                const promises = [];

                // Checks if the home has been found
                platform.home = me.homes.find(function(h) { return h.name === platform.config.homeName; });
                if (!platform.home) {
                    platform.log('Home with specified name not found.');
                    return;
                }

                // Gets the zones of the home
                promises.push(platform.client.getZones(platform.home.id).then(function(apiZones) {
                    platform.apiZones = apiZones;

                    // Creates the zones
                    for (let i = 0; i < apiZones.length; i++) {
                        const apiZone = apiZones[i];

                        // Checks if the zone has devices
                        if (!apiZone.devices.length) {
                            continue;
                        }

                        // Adds the heating zone
                        if (apiZone.type === 'HEATING') {
                            platform.log('Create heating zone with ID ' + apiZone.id + ' and name ' + apiZone.name + '.');
                            const zone = new TadoHeatingZone(platform, apiZone);
                            platform.zones.push(zone);
                        }
                    }

                    // Initially updates the zones
                    for (let i = 0; i < platform.zones.length; i++) {
                        const zone = platform.zones[i];
                        zone.updateZone(apiZones);
                    }

                    // Starts the timer for updating zones
                    setInterval(function() {
                        platform.client.getZones(platform.home.id).then(function(apiZones) {
                            platform.apiZones = apiZones;
                            for (let i = 0; i < platform.zones.length; i++) {
                                const zone = platform.zones[i];
                                zone.updateZone(apiZones);
                            }
                        }, function() {
                            platform.log('Error while getting zones.');
                        });
                    }, platform.config.zoneUpdateInterval * 1000);
                }, function() {
                    platform.log('Error while getting zones.');
                }));

                // Adds the occupancy sensors
                if (platform.config.areOccupancySensorsEnabled) {
                    promises.push(platform.client.getMobileDevices(platform.home.id).then(function(apiMobileDevices) {
                        platform.apiMobileDevices = apiMobileDevices;

                        // Creates the mobile devices
                        for (let i = 0; i < apiMobileDevices.length; i++) {
                            const apiMobileDevice = apiMobileDevices[i];

                            // Checks if the mobile device is geo-fence enabled
                            if (!apiMobileDevice.settings || !apiMobileDevice.settings.geoTrackingEnabled) {
                                continue;
                            }

                            // Adds the mobile device
                            platform.log('Create mobile device with ID ' + apiMobileDevice.id + ' and name ' + apiMobileDevice.name + '.');
                            const mobileDevice = new TadoMobileDevice(platform, apiMobileDevice);
                            platform.mobileDevices.push(mobileDevice);
                        }

                        // Initially updates the mobile devices
                        for (let i = 0; i < platform.mobileDevices.length; i++) {
                            const mobileDevice = platform.mobileDevices[i];
                            mobileDevice.updateMobileDevice(apiMobileDevices);
                        }

                        // Starts the timer for updating mobile devices
                        setInterval(function() {
                            platform.client.getMobileDevices(platform.home.id).then(function(apiMobileDevices) {
                                platform.apiMobileDevices = apiMobileDevices;
                                for (let i = 0; i < platform.mobileDevices.length; i++) {
                                    const mobileDevice = platform.mobileDevices[i];
                                    mobileDevice.updateMobileDevice(apiMobileDevices);
                                }
                            }, function() {
                                platform.log('Error while getting mobile devices.');
                            });
                        }, platform.config.occupancyUpdateInterval * 1000);
                    }, function() {
                        platform.log('Error while getting mobile devices.');
                    }));
                }

                // Removes unused accessories
                Promise.all(promises).then(function() {

                    // Removes the accessories that are not bound to a zone
                    let unusedAccessories = platform.accessories.filter(function(a) { return !platform.zones.some(function(z) { return z.id === a.context.id; }) && !platform.mobileDevices.some(function(m) { return m.id === a.context.id; }); });
                    for (let i = 0; i < unusedAccessories.length; i++) {
                        const unusedAccessory = unusedAccessories[i];
                        platform.log('Removing accessory with ID ' + unusedAccessory.context.id + ' and kind ' + unusedAccessory.context.kind + '.');
                        platform.accessories.splice(platform.accessories.indexOf(unusedAccessory), 1);
                    }
                    platform.api.unregisterPlatformAccessories(platform.pluginName, platform.platformName, unusedAccessories);
                    platform.log('Initialization completed.');

                    // Starts the API if requested
                    if (platform.config.isApiEnabled) {
                        platform.tadoApi = new TadoApi(platform);
                    }
                }, function() {
                    platform.log('Initialization could not be completed due to an error.');
                });
            }, function() {
                platform.log('Error while getting the account data.');
            });
        }, function() {
            platform.log('Error while logging in. Please check your credentials.');
        }); 
    });
}

/**
 * Configures a previously cached accessory.
 * @param accessory The cached accessory.
 */
TadoPlatform.prototype.configureAccessory = function (accessory) {
    const platform = this;

    // Adds the cached accessory to the list
    platform.accessories.push(accessory);
}

/**
 * Defines the export of the file.
 */
module.exports = TadoPlatform;
