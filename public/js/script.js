'use strict';

var $container = $('#container');

var UserList = React.createClass({
  getInitialState: function() {
    return {
      data: []
    };
  },
  loadUsers: function() {
    var time = new Date().getTime();
    // Avoid crushing GitHub rate limit (5000 per hour).
    // The more users you're checking in on, the longer this should be.
    var delay_seconds = 300;
    var msg;
    mixpanel.track("Loading fresh data");
    $container.addClass('loading');
    $.ajax({
      url: this.props.url,
      dataType: 'json',
      success: function(data) {
        var msg;
        $container.removeClass('loading');
        if(data.used_cache) {
          msg = "Showing recently cached data. " + data.cache_expires + " seconds left";
          mixpanel.track("Showing cached data");
        } else {
          msg = "Fetching new data";
          mixpanel.track("Loaded data successfully");
        }
        this.setState({
          message: msg,
          data: data.users
        });
      }.bind(this),
      error: function(xhr, status, err) {
        $container.removeClass('loading');
        mixpanel.track("Error loading data");
        console.error(this.props.url, status, err.toString());
      }.bind(this)
    });
  },
  componentDidMount: function() {
    this.loadUsers();
  },
  render: function() {
    var userNodes = this.state.data.map(function(user) {
      return (
        <User user={user}></User>
      );
    });
    return (
      <ul className="user-list">
        {userNodes}
        <p className="message">{this.state.message}</p>
      </ul>
    );
  }
});

var User = React.createClass({
  getInitialState: function() {
    return {
      user: {}
    }
  },
  render: function() {
    return (
      <li className="user">
        <a href={this.props.user.home_url}>
          <img className="avatar" src={this.props.user.avatar} />
          <div className="name"   >{this.props.user.name} <span className="username">{this.props.user.username}</span></div>
          <div className="timeago">Last push: {this.props.user.last_pushed}</div>
        </a>
      </li>
    );
  }
});

React.render(
  <UserList url="/data" />,
  document.getElementById('container')
);
