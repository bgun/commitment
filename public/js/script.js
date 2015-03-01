'use strict';

var UserList = React.createClass({
  getInitialState: function() {
    return {
      data: []
    };
  },
  loadComments: function() {
    var time = new Date().getTime();
    // Avoid crushing GitHub rate limit (5000 per hour).
    // The more users you're checking in on, the longer this should be.
    var delay_seconds = 300;
    var msg, cached_data, time_left;
    cached_data = JSON.parse(localStorage.getItem('users'));
    if(cached_data && (cached_data.updated+(delay_seconds*1000) > time)) {
      time_left = Math.round(delay_seconds - ((time-cached_data.updated)/1000));
      msg = "Showing recently cached data. " + time_left + " seconds till delay expires";
      mixpanel.track("Showing cached data");
      this.setState({
        message: msg,
        data: cached_data.users
      });
    } else {
      console.log("No recently cached data found. Loading...");
      mixpanel.track("Loading fresh data");
      $('#container').addClass('loading');
      $.ajax({
        url: this.props.url,
        dataType: 'json',
        success: function(data) {
          $('#container').removeClass('loading');
          localStorage.setItem('users', JSON.stringify(data));
          mixpanel.track("Loaded data successfully");
          this.setState({
            message: "Fetching new data",
            data: data.users
          });
        }.bind(this),
        error: function(xhr, status, err) {
          console.error(this.props.url, status, err.toString());
          mixpanel.track("Error loading data");
        }.bind(this)
      });
    }
  },
  componentDidMount: function() {
    this.loadComments();
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
