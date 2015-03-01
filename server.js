var express = require('express');
var request = require('request');
var Q = require('q');
var _ = require('lodash');

var app = express();

app.get('/', function(req, res) {
  var options = {
    url: 'https://api.github.com/users/bgun/repos',
    headers: {
      'User-Agent': 'bgun'
    }
  };
  request.get(options, function(error, resp, body) {
    console.log(body);
    if (!error && resp.statusCode == 200) {
      res.send(JSON.parse(body)[0]);
    } else {
      res.send("error");
    }
  });
});

app.listen(9005);
