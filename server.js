'use strict';

var express = require('express');
var request = require('request');
var Q = require('q');
var _ = require('lodash');
var moment = require('moment');

// stuff that shouldn't be in repo. Replace with your values
var settings = require('./_settings.js');

var app = express();
app.use('/public', express.static(__dirname + "/public"));

var usernames = settings.users; // array of usernames to check

// replacement values
var tokens = {
  gh_base      : 'https://api.github.com/',
  client_id    : settings.CLIENT_ID,
  client_secret: settings.CLIENT_SECRET
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

app.get('/', function(req, res) {
  res.sendFile(__dirname+'/public/html/index.html');
});

app.get('/data', function(req, res) {
  // test data
  /*
  var users = [
    {
      username: "Jvvlives2005",
      pushed_at: "2015-02-28T20:53:24Z",
      last_pushed: "Yesterday at 3:53 PM",
      avatar: "https://avatars.githubusercontent.com/u/11141437?v=3",
      name: "Joshelyn Vivas",
      home_url: "https://github.com/theaulait"
    },
    {
      username: "ReinardCox",
      pushed_at: "2015-02-28T20:52:20Z",
      last_pushed: "Yesterday at 3:52 PM",
      avatar: "https://avatars.githubusercontent.com/u/11142904?v=3",
      name: "Reinard Cox",
      home_url: "https://github.com/theaulait"
    },
    {
      username: "jorgereina1986",
      pushed_at: "2015-02-28T20:52:20Z",
      last_pushed: "Yesterday at 3:52 PM",
      avatar: "https://avatars.githubusercontent.com/u/11138952?v=3",
      home_url: "https://github.com/theaulait"
    },
    {
      username: "Jvvlives2005",
      pushed_at: "2015-02-28T20:53:24Z",
      last_pushed: "Yesterday at 3:53 PM",
      avatar: "https://avatars.githubusercontent.com/u/11141437?v=3",
      name: "Joshelyn Vivas",
      home_url: "https://github.com/theaulait"
    },
    {
      username: "ReinardCox",
      pushed_at: "2015-02-28T20:52:20Z",
      last_pushed: "Yesterday at 3:52 PM",
      avatar: "https://avatars.githubusercontent.com/u/11142904?v=3",
      name: "Reinard Cox",
      home_url: "https://github.com/theaulait"
    },
    {
      username: "jorgereina1986",
      pushed_at: "2015-02-28T20:52:20Z",
      last_pushed: "Yesterday at 3:52 PM",
      avatar: "https://avatars.githubusercontent.com/u/11138952?v=3",
      home_url: "https://github.com/theaulait"
    }
  ];
  console.log("Sending %d test items", users.length); 
  res.send({
    updated: new Date().getTime(),
    users: users
  });
  */
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

          var data = _(repos)
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
            .reverse();

          res.send({
            updated: new Date().getTime(),
            users: data
          });

        })
        .done();
    })
    .done();
});

app.listen(9005);
