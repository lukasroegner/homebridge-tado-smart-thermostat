
const Tado = require('node-tado-client');

const TadoHeatingZone = require('./tado-heating-zone');

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
    platform.accessories = [];

    // Initializes the configuration
    platform.config.username = platform.config.username || null;
    platform.config.password = platform.config.password || null;
    platform.config.homeName = platform.config.homeName || null;
    platform.config.switchToAutoInNextTimeBlock = platform.config.switchToAutoInNextTimeBlock || false;
    platform.config.zoneUpdateInterval = platform.config.zoneUpdateInterval || 3600;
    platform.config.stateUpdateInterval = platform.config.stateUpdateInterval || 60;

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

                // Checks if the home has been found
                platform.home = me.homes.find(function(h) { return h.name === platform.config.homeName; });
                if (!platform.home) {
                    platform.log('Home with specified name not found.');
                    return;
                }

                // Gets the zones of the home
                platform.client.getZones(platform.home.id).then(function(apiZones) {

                    // Creates the zones
                    for (let i = 0; i < apiZones.length; i++) {
                        const apiZone = apiZones[i];

                        // Checks if the zone has devices
                        if (!apiZone.devices.length) {
                            continue;
                        }

                        // Adds the heating zone
                        if (apiZone.type === 'HEATING') {
                            platform.log('Create heating zone with ID ' + apiZone.id + '.');
                            const zone = new TadoHeatingZone(platform, apiZone);
                            platform.zones.push(zone);
                        }
                    }

                    // Removes the accessories that are not bound to a zone
                    let unusedAccessories = platform.accessories.filter(function(a) { return !platform.zones.some(function(z) { return z.id === a.context.id; }); });
                    for (let i = 0; i < unusedAccessories.length; i++) {
                        const unusedAccessory = unusedAccessories[i];
                        platform.log('Removing accessory with zone ID ' + unusedAccessory.context.id + ' and kind ' + unusedAccessory.context.kind + '.');
                        platform.accessories.splice(platform.accessories.indexOf(unusedAccessory), 1);
                    }
                    platform.api.unregisterPlatformAccessories(platform.pluginName, platform.platformName, unusedAccessories);
                    platform.log('Initialization completed.');

                    // Initially updates the zones
                    for (let i = 0; i < platform.zones.length; i++) {
                        const zone = platform.zones[i];
                        zone.updateZone(apiZones);
                    }

                    // Starts the timer for updating zones
                    setInterval(function() {
                        platform.client.getZones(platform.home.id).then(function(apiZones) {
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
