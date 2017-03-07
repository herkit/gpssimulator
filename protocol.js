module.exports.getFrame = function(track) {
  var toSend = 
    '(' + track.deviceid + 'BR00' + 
    track.timeparts.slice(0, 3).join('') + 
    'A' + latToDegMinHemi(track.lat) + 
    lngToDegMinHemi(track.lng) + 
    ("000" + (track.speed / 1.852).toFixed(1)).slice(-5) + 
    track.timeparts.slice(-3).join('') + 
    track.bearing.toFixed(1) + ',00000000L00000000)';
  return toSend;
}

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
