var argv = require('minimist')(process.argv.slice(2), {
  alias: {
    "deviceid": "e",
    "location": "l",
    "interval": "i",
    "variance": "v",
    "nosend": "n"
  }
});

argv.deviceid = argv.deviceid || "087073819397";
argv.variance = argv.variance || 5;
argv.interval = argv.interval || 20;

var LatLon = require("./lib/geo").LatLon;
var protocol = require('./protocol');
var net = require('net');

var locationparts = argv.location.split(',');
if (locationparts.length != 2) {
  client.close();
  process.exit(1);
}
var location = new LatLon(parseFloat(locationparts[0]),parseFloat(locationparts[1]));

console.log("Sending stationary around", location);

var client = new net.Socket();
client.connect(10002, '127.0.0.1', function() {

  function send() {
    var bearing = getRandomInt(0, 360);
    var addDistance = getRandomInt(0, argv.variance);
    var maskedLatLon = location.destinationPoint(addDistance, bearing);
    var toSend = protocol.getFrame({
      deviceid: argv.deviceid,
      timeparts: getTimeParts(),
      lat: maskedLatLon.lat,
      lng: maskedLatLon.lon,
      speed: 0,
      bearing: bearing
    });

    console.log(toSend);

    if (!argv.nosend)
      client.write(toSend);

    setTimeout(send, argv.interval * 1000);
  }
  send();
});

function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min)) + min;
}

function getTimeParts() {
  var t = new Date();
  return [
    t.getUTCFullYear().toString().slice(-2),
    ('00' + (t.getUTCMonth() + 1)).slice(-2),
    ('00' + t.getUTCDate()).slice(-2),
    ('00' + t.getUTCHours()).slice(-2),
    ('00' + t.getUTCMinutes()).slice(-2),
    ('00' + t.getUTCSeconds()).slice(-2),
  ]
}