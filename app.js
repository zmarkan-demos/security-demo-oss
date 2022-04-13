const express = require('express');
const path = require('path');
var app = express();
let PORT = process.env.PORT || 3232


app.get('/', function(req, res) {
    res.sendFile(path.join(__dirname, '/index.html'));
  });
  
var server = app.listen(PORT, function () {
    console.log("Node server is running on port: "+ server.address().port);
});

module.exports = server;
