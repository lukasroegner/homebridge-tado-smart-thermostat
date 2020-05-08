# homebridge-tado-smart-thermostat

This project is a homebridge plugin for Tado heating devices. Each zone (i.e. room) in the Tado app is exposed to HomeKit as a thermostat.

The reason for development of the plugin is that the native Tado HomeKit support does not differentiate between AUTO mode and MANUAL mode. If you change the target temperature in HomeKit, Tado always switches to MANUAL mode. 

## Thermostat

Each zone in the Tado app is exposed to HomeKit as a thermostat with the following features:
* Current mode: OFF, HEATING, AUTO
* Target mode: OFF, HEATING, AUTO
* Current temperature
* Target temperature
* Current humidity
* Battery warning
* Window state: CLOSED, OPEN (only visible if the open window detection is enabled for the zone)

Global features:
* Possibility to expose occupancy sensors for all Tado users
* Possibility to expose the global Home/Away state as occupancy sensor with security system settings 

## Installation

Install the plugin via npm:

```bash
npm install -g homebridge-tado-smart-thermostat
```

## Configuration

```json
{
    "platforms": [
        {
            "platform": "TadoPlatform",
            "username": "<YOUR-USER-NAME>",
            "password": "<YOUR-PASSWORD>",
            "homeName": "<YOUR-HOME-NAME>",
            "areOccupancySensorsEnabled": false,
            "isGlobalHomeAwayEnabled": false,
            "switchToAutoInNextTimeBlock": false,
            "zoneUpdateInterval": 3600,
            "stateUpdateInterval": 60,
            "occupancyUpdateInterval": 60,
            "homeUpdateInterval": 60,
            "isApiEnabled": false,
            "apiPort": 40810,
            "apiToken": "<YOUR-TOKEN>"
        }
    ]
}
```

**username**: The user name that you use for the app and the web app of Tado.

**password**: The password that you use for the app and the web app of Tado.

**homeName**: The name of the home you want to expose to HomeKit as written in the Tado app. Has to be the exact same name as in the web app of Tado.

**areOccupancySensorsEnabled** (optional): Determines whether occupancy sensors are exposed for the Tado users. Defaults to `false`.

**isGlobalHomeAwayEnabled** (optional): Determines whether the global Home/Away state is exposed as occupancy sensor with security system settings to HomeKit. Defaults to `false`.

**switchToAutoInNextTimeBlock** (optional): If set to `true`, the state of the zone is switch back to AUTO in the next time block of the time table (same behavior as the zone setting for manual changes on the device itself). Defaults to `false`.

**zoneUpdateInterval** (optional): The polling interval in seconds, at which the zone is updated (used for battery state updates). Defaults to 1 hour.

**stateUpdateInterval** (optional): The polling interval in seconds, at which the state of a thermostat is updated. Defaults to 60 seconds.

**occupancyUpdateInterval** (optional): The polling interval in seconds, at which the state of the occupancy sensors is updated. Only used when `areOccupancySensorsEnabled` is set to `true`. Defaults to 60 seconds.

**homeUpdateInterval** (optional): The polling interval in seconds, at which the state of the home is updated. Only used when `isGlobalHomeAwayEnabled` is set to `true`. Defaults to 60 seconds.

**isApiEnabled** (optional): Enables an HTTP API for controlling Tado zones. Defaults to `false`. See **API** for more information.

**apiPort** (optional): The port that the API (if enabled) runs on. Defaults to `40810`, please change this setting of the port is already in use.

**apiToken** (optional): The token that has to be included in each request of the API. Is required if the API is enabled and has no default value.

## API

This plugin also provides an HTTP API to control some features of the Tado system. It has been created so that you can further automate the system with HomeKit shortcuts. Starting with iOS 13, you can use shortcuts for HomeKit automation. Those automations that are executed on the HomeKit coordinator (i.e. iPad, AppleTV or HomePod) also support HTTP requests, which means you can automate your Tado system without annoying switches and buttons exposed in HomeKit.

If the API is enabled, it can be reached at the specified port on the host of this plugin. 
```
http://<YOUR-HOST-IP-ADDRESS>:<apiPort>
```

The token has to be specified as value of the `Authorization` header on each request:
```
Authorization: <YOUR-TOKEN>
```

### API - Get values of Tado zone

Use the `zones/<ZONE-NAME>/<PROPERTY-NAME>` endpoint to retrieve a single value of a Tado zone. The HTTP method has to be `GET`:
```
http://<YOUR-HOST-IP-ADDRESS>:<apiPort>/zones/<ZONE-NAME>/<PROPERTY-NAME>
```

The response is a plain text response (easier to handle in HomeKit shortcuts), the following property names are supported:

* **target-state** The target state of the zone (possible values: `auto`, `manual`, `off`)
* **target-temperature** The target temperature of the zone as numeric value (range: `5-25`)

Use the `zones/<ZONE-NAME>` endpoint to retrieve all values of a Tado zone. The HTTP method has to be `GET`:
```
http://<YOUR-HOST-IP-ADDRESS>:<apiPort>/zones/<ZONE-NAME>
```

The response is a JSON object containing all values:
```
{
    "target-state": "manual",
    "target-temperature": 20
}
```

### API - Set values of Tado zone

Use the `zones/<ZONE-NAME>` endpoint to set values of a Tado zone. The HTTP method has to be `POST`:
```
http://<YOUR-HOST-IP-ADDRESS>:<apiPort>/zones/<ZONE-NAME>
```

The body of the request has to be JSON containing the new values:
```
{
    "<PROPERTY-NAME>": <VALUE>
}
```
Multiple properties can be set with one request.

The following property names are supported:

* **target-state** The target state of the zone (possible values: `auto`, `manual`, `off`)
* **target-temperature** The target temperature of the zone as numeric value (range: `5-25`)
