# MQTT-ECHO
**Mqtt republishing utility**

Simple Node Js utility to re-publish one mqtt topic from one broker using a different broker
The keys of the published json can be re-named and the data can be published under a specified topic.
Supports forwarding of nested json values.

The target broker client can subscribe to an additional topic which will indicate that the mqtt echo is connected and operational.

## Release 1.0.0
Initial release of code and configuration examplews.
Was Win 7 with with a TTN Broker source and Mosquitto Target broker.

## How to Install
Clone or unzip repository.
Open shell or the windows cmd, cd inside and type:
```js
npm install
```
## Configuration
All of the broker specific data are to be kept in a seperate json file.
A "exampleConfig.json" config file was attached for reference.
The cofig file path should be be passed as -c input argument.

## How to run
Open shell or the windows cmd, cd inside and type:
```js
node mqttForwarder.js -c <PATH_TO_CONFIG_FILE>
```