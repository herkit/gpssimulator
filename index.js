var argv = require('minimist')(process.argv.slice(2), {
  alias: {
    "destination": "d",
    "origin": "o",
    "waypoint": "w",
    "key": "k"
  }
});

if (!Array.isArray(argv.waypoint))
  argv.waypoint = [argv.waypoint];

var LatLon = require("./lib/geo").LatLon;
var publicConfig = {
  key: argv.k || process.env.GOOGLE_API_KEY,
  stagger_time:       1000, // for elevationPath
  encode_polylines:   false,
  secure:             true // use https
}

var GoogleMapsAPI = require('googlemaps');

var gmAPI = new GoogleMapsAPI(publicConfig);

var directionParams = {
  "origin":    argv.o,
  "destination": argv.d,
  "waypoints": argv.waypoint.join('|')
};

var polyUtil = require('polyline-encoded');

//1203292316,0031698765432,GPRMC,211657.000,A,5213.0247,N,00516.7757,E,0.00,273.30,290312,,,A*62,F,imei:123456789012345,123

var net = require('net');

var client = new net.Socket();
client.connect(10002, '127.0.0.1', function() {
  gmAPI.directions(directionParams, function(err, result) {
    if (err)
      console.log(err);
    else {
      var encoded = result.routes[0].overview_polyline.points;
      var latlngs = polyUtil.decode(encoded).map(function(coord) { return new LatLon(coord[0], coord[1]); });
      var lastCoord;
      var nextCoord;
      var currentDistance = 0;
      var speed = 90; //kmh
      var intermediateFraction = 0;
      var intervalLength = 2;
      var distancePerInterval = speed * 1000 / 3600 * intervalLength;

      var interval = setInterval((coords) => {
        if (lastCoord) {
          intermediateFraction += (distancePerInterval / currentDistance);
          if (intermediateFraction > 1) intermediateFraction = 1;

          if(intermediateFraction >= 1)
          {
            lastCoord = nextCoord;
            nextCoord = coords.shift();
            currentDistance = lastCoord.distanceTo(nextCoord);
            intermediateFraction = 0;
          }
        } else {
          lastCoord = coords.shift();
          nextCoord = coords.shift();
          currentDistance = lastCoord.distanceTo(nextCoord);
          intermediateFraction = 0;
        }

        if (nextCoord) {
          var coord = lastCoord.intermediatePointTo(nextCoord, intermediateFraction);
          var speed = 0.3;
          console.log("Sending position", coord);
          var toSend = '(087073819397BR00170205A' + latToDegMinHemi(coord.lat) + lngToDegMinHemi(coord.lon) + '000.3172029000.00,00000000L00000000)';
          console.log("Sending", toSend);
          client.write(toSend);
        } else {
          clearInterval(interval);
        }
      }, intervalLength * 1000, latlngs)
    }
  })
});

client.on('data', function(data) {
  console.log('Received: ' + data);
  client.destroy(); // kill client after server's response
});

client.on('close', function() {
  console.log('Connection closed');
});

function latToDegMinHemi(position) {
  var pos = Math.abs(position);
  var deg = Math.trunc(pos);
  var min = (pos - deg) * 60;
  var degmin = deg * 100 + Math.trunc(min);  
  var minfrac = min - Math.trunc(min);
  var hemi = (position >= 0) ? "N" : "S";
  return ("0000" + degmin).slice(-4) + "." + (Math.round(minfrac*10000) / 10000).toPrecision(4).slice(2,6) + hemi;
}

function lngToDegMinHemi(position) {
  var pos = Math.abs(position);
  var deg = Math.trunc(pos);
  var min = (pos - deg) * 60;
  var degmin = deg * 100 + Math.trunc(min);  
  var minfrac = min - Math.trunc(min);
  var hemi = (position >= 0) ? "E" : "W";
  return ("00000" + degmin).slice(-5) + "." + (Math.round(minfrac*10000) / 10000).toPrecision(4).slice(2,6) + hemi;
}
