
const http = require('http');
const url = require('url');

/**
 * Represents the API.
 * @param platform The TadoPlatform instance.
 */
function TadoApi(platform) {
    const api = this;

    // Sets the platform
    api.platform = platform;

    // Checks if all required information is provided
    if (!api.platform.config.apiPort) {
        api.platform.log('No API port provided.');
        return;
    }
    if (!api.platform.config.apiToken) {
        api.platform.log('No API token provided.');
        return;
    }

    // Starts the server
    try {
        http.createServer(function (request, response) {
            const payload = [];

            // Subscribes for events of the request
            request.on('error', function () {
                api.platform.log('API - Error received.');
            }).on('data', function (chunk) {
                payload.push(chunk);
            }).on('end', function () {

                // Subscribes to errors when sending the response
                response.on('error', function () {
                    api.platform.log('API - Error sending the response.');
                });

                // Validates the token
                if (!request.headers['authorization']) {
                    api.platform.log('Authorization header missing.');
                    response.statusCode = 401;
                    response.end();
                    return;
                }
                if (request.headers['authorization'] !== api.platform.config.apiToken) {
                    api.platform.log('Token invalid.');
                    response.statusCode = 401;
                    response.end();
                    return;
                }

                // Validates the endpoint
                const endpoint = api.getEndpoint(request.url);
                if (!endpoint) {
                    api.platform.log('No endpoint found.');
                    response.statusCode = 404;
                    response.end();
                    return;
                }
            
                // Validates the body
                let body = null;
                if (payload && payload.length > 0) {
                    body = JSON.parse(Buffer.concat(payload).toString());
                }
                
                // Performs the action based on the endpoint and method
                switch (endpoint.name) {
                    case 'propertyByZone':
                        switch (request.method) {
                            case 'GET':
                                api.handleGetPropertyByZone(endpoint, response);
                                return;
                        }
                        break;

                    case 'zone':
                        switch (request.method) {
                            case 'GET':
                                api.handleGetZone(endpoint, response);
                                return;

                            case 'POST':
                                api.handlePostZone(endpoint, body, response);
                                return;
                        }
                        break;
                }

                api.platform.log('No action matched.');
                response.statusCode = 404;
                response.end();
            });
        }).listen(api.platform.config.apiPort, "0.0.0.0");
        api.platform.log('API started.');
    } catch (e) {
        api.platform.log('API could not be started: ' + JSON.stringify(e));
    }
}

/**
 * Handles requests to GET /zones/{zoneName}/{propertyName}.
 * @param endpoint The endpoint information.
 * @param response The response object.
 */
TadoApi.prototype.handleGetPropertyByZone = function (endpoint, response) {
    const api = this;

    // Checks if the zone exists
    const apiZone = api.platform.apiZones.find(function(z) { return z.id === endpoint.zoneId; });
    if (!apiZone) {
        api.platform.log('Zone not found.');
        response.statusCode = 400;
        response.end();
        return;
    }

    // Gets the value based on property name
    switch (endpoint.propertyName) {
        case 'target-state':
            response.setHeader('Content-Type', 'text/plain');
            if (apiZone.state.overlayType) {
                response.write('manual');
            } else if (apiZone.state.setting.power === 'ON') {
                response.write('auto');
            } else {
                response.write('off');
            }
            response.statusCode = 200;
            response.end();
            return;

        case 'target-temperature':
            if (apiZone.state.setting.temperature) {
                response.write(apiZone.state.setting.temperature.celsius.toString());
            } else {
                response.write('null');
            }
            response.statusCode = 200;
            response.end();
            return;
    }

    // Writes the response
    api.platform.log('Error while retrieving value.');
    response.statusCode = 400;
    response.end();
}

/**
 * Handles requests to GET /zones/{zoneName}.
 * @param endpoint The endpoint information.
 * @param response The response object.
 */
TadoApi.prototype.handleGetZone = function (endpoint, response) {
    const api = this;

    // Checks if the zone exists
    const apiZone = api.platform.apiZones.find(function(z) { return z.id === endpoint.zoneId; });
    if (!apiZone) {
        api.platform.log('Zone not found.');
        response.statusCode = 400;
        response.end();
        return;
    }

    // Gets all properties
    const responseObject = {};
    response.setHeader('Content-Type', 'application/json');
    if (apiZone.state.overlayType) {
        responseObject['target-state'] = 'manual';
    } else if (apiZone.state.setting.power === 'ON') {
        responseObject['target-state'] = 'auto';
    } else {
        responseObject['target-state'] = 'off';
    }
    if (apiZone.state.setting.temperature) {
        responseObject['target-temperature'] = apiZone.state.setting.temperature.celsius;
    } else {
        responseObject['target-temperature'] = null;
    }
    response.write(JSON.stringify(responseObject));
    response.statusCode = 200;
    response.end();
}

/**
 * Handles requests to POST /zones/{zoneName}.
 * @param endpoint The endpoint information.
 * @param body The body of the request.
 * @param response The response object.
 */
TadoApi.prototype.handlePostZone = function (endpoint, body, response) {
    const api = this;

    // Checks if the zone exists
    const apiZone = api.platform.apiZones.find(function(z) { return z.id === endpoint.zoneId; });
    if (!apiZone) {
        api.platform.log('Zone not found.');
        response.statusCode = 400;
        response.end();
        return;
    }

    // Validates the content
    if (!body) {
        api.platform.log('Body invalid.');
        response.statusCode = 400;
        response.end();
        return;
    }

    // Sets the new value
    const promises = [];
    for (let propertyName in body) {
        const zonePropertyValue = body[propertyName];
        switch (propertyName) {
            case 'target-state':
                if (zonePropertyValue == 'auto') {
                    promises.push(api.platform.client.clearZoneOverlay(api.platform.home.id, apiZone.id));
                } else if (zonePropertyValue == 'manual') {
                    if (body['target-temperature']) {
                        break;
                    }
                    if (apiZone.state.setting.temperature) {
                        promises.push(api.platform.client.setZoneOverlay(api.platform.home.id, apiZone.id, 'on', apiZone.state.setting.temperature.celsius, api.platform.config.switchToAutoInNextTimeBlock ? 'auto' : 'manual'));
                    } else {
                        promises.push(api.platform.client.setZoneOverlay(api.platform.home.id, apiZone.id, 'on', 5, platform.config.switchToAutoInNextTimeBlock ? 'auto' : 'manual'));
                    }
                } else if (zonePropertyValue == 'off') {
                    if (apiZone.state.setting.temperature) {
                        promises.push(api.platform.client.setZoneOverlay(api.platform.home.id, apiZone.id, 'off', apiZone.state.setting.temperature.celsius, api.platform.config.switchToAutoInNextTimeBlock ? 'auto' : 'manual'));
                    } else {
                        promises.push(api.platform.client.setZoneOverlay(api.platform.home.id, apiZone.id, 'off', 5, platform.config.switchToAutoInNextTimeBlock ? 'auto' : 'manual'));
                    }
                }
                break;
        
            case 'target-temperature':
                promises.push(api.platform.client.setZoneOverlay(api.platform.home.id, apiZone.id, 'on', zonePropertyValue, api.platform.config.switchToAutoInNextTimeBlock ? 'auto' : 'manual'));
                break;
        }
    }

    // Writes the response
    Promise.all(promises).then(function() {
        response.statusCode = 200;
        response.end();
    }, function() {
        api.platform.log('Error while setting value.');
        response.statusCode = 400;
        response.end();
    });
}

/**
 * Gets the endpoint information based on the URL.
 * @param uri The uri of the request.
 * @returns Returns the endpoint information.
 */
TadoApi.prototype.getEndpoint = function (uri) {

    // Parses the request path
    const uriParts = url.parse(uri);

    // Checks if the URL matches the zones endpoint with property name
    let uriMatch = /\/zones\/(.+)\/(.+)/g.exec(uriParts.pathname);
    if (uriMatch && uriMatch.length === 3) {
        return {
            name: 'propertyByZone', 
            zoneId: parseInt(decodeURI(uriMatch[1])),
            propertyName: decodeURI(uriMatch[2])
        };
    }

    // Checks if the URL matches the zones endpoint without property name
    uriMatch = /\/zones\/(.+)/g.exec(uriParts.pathname);
    if (uriMatch && uriMatch.length === 2) {
        return {
            name: 'zone',
            zoneId: parseInt(decodeURI(uriMatch[1]))
        };
    }

    // Returns null as no endpoint matched.
    return null;
}

/**
 * Defines the export of the file.
 */
module.exports = TadoApi;
