'use strict';

var express = require('express');
var request = require('request');
var Q = require('q');
var _ = require('lodash');
var moment = require('moment-timezone');
var port = process.env.PORT || 9005;

moment().tz("America/New_York").format();

var app = express();
app.use('/public', express.static(__dirname + "/public"));

var usernames = (process.env.GITHUB_USERNAMES || '').split(',');

// replacement values
var tokens = {
  gh_base      : 'https://api.github.com/',
  client_id    : process.env.GITHUB_CLIENT_ID,
  client_secret: process.env.GITHUB_CLIENT_SECRET
};

// super simple string formatter
var formatString = function(str, tokens) {
  _.each(tokens, function(v, k) {
    str = str.replace('{{'+k+'}}', v);
  });
  //console.log("Formatted",str);
  return str;
};

var authParams = '?'+[
  'client_id={{client_id}}',
  'client_secret={{client_secret}}'
].join('&');

// GitHub endpoints
var endpoints = {
  user : '{{gh_base}}users/{{username}}',
  repos: '{{gh_base}}users/{{username}}/repos'
};

var makeRequest = function(type, username) {
  var tk = _.extend({
    username: username
  }, tokens);
  var options = {
    url: formatString(endpoints[type]+authParams, tk),
    headers: {
      'User-Agent': 'bgun'
    }
  };
  return options;
};

var getUser = function(username) {
  var deferred = Q.defer();
  request.get(makeRequest('user', username), function(error, resp, body) {
    if (!error && resp.statusCode == 200) {
      var data = JSON.parse(body);
      deferred.resolve(data);
    } else {
      deferred.reject('failed');
    }
  });
  return deferred.promise;
};

var getLastUpdatedRepoForUser = function(username) {
  var deferred = Q.defer();
  request.get(makeRequest('repos', username), function(error, resp, body) {
    if (!error && resp.statusCode == 200) {
      var data = JSON.parse(body);
      if(data.length > 0) {
        data = _.sortBy(data, 'pushed_at').reverse();
        //console.log(username+' success');
        deferred.resolve(data[0]);
      } else {
        //console.log(username+' has no repos');
        deferred.resolve({});
      }
    } else {
      //console.log(username+' failed', resp.statusCode);
      deferred.reject('failed');
    }
  });
  return deferred.promise;
};

var getLiveData = function() {
  var deferred = Q.defer();
  var user_promises = _.map(usernames, function(n) {
    return getUser(n);
  });
  var repo_promises = _.map(usernames, function(n) {
    return getLastUpdatedRepoForUser(n);
  });
  // fire all the things!
  Q.all(user_promises)
    .then(function(users) {

      Q.all(repo_promises)
        .then(function(repos) {

          var output = _(repos)
            .map(function(r, i) {
              return _.extend({
                username: usernames[i],
                pushed_at   : r.pushed_at ? r.pushed_at : '',
                last_pushed : r.pushed_at ? moment(r.pushed_at).calendar() : 'Never'
              }, {
                avatar   : users[i].avatar_url,
                name     : users[i].name || 'unknown',
                home_url : users[i].html_url
              });
            })
            .sortBy('pushed_at')
            .reverse()
            .value();

          console.log("Returning live data, "+output.length+" users");
          deferred.resolve({
            updated: new Date().getTime(),
            users: output
          });

        })
        .done();
    })
    .done();

  return deferred.promise;
};

var getTestData = function() {
  var deferred = Q.defer();
  console.log("Returning test data");
  deferred.resolve({
    test: true,
    updated: 0,
    users: test_data.users
  });
  return deferred.promise;
};

app.get('/', function(req, res) {
  res.sendFile(__dirname+'/public/html/index.html');
});

app.get('/data', function(req, res) {
  console.log(req.query);
  var promise = req.query.test ? getTestData() : getLiveData();
  promise
    .then(function(data) {
      res.send(data);
    })
    .done();
});

console.log("Starting server on port "+port);
app.listen(port);
