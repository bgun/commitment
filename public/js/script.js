'use strict';

var UserList = React.createClass({
  getInitialState: function() {
    return {
      data: []
    };
  },
  loadComments: function() {
    $.ajax({
      url: this.props.url,
      dataType: 'json',
      success: function(data) {
        this.setState({ data: data.users });
      }.bind(this),
      error: function(xhr, status, err) {
        console.error(this.props.url, status, err.toString());
      }.bind(this)
    });
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
    console.log(this.props);
    return (
      <li className="user">
        <a href={this.props.user.home_url}>
          <img className="avatar" src={this.props.user.avatar} />
          <div className="name"   >{this.props.user.name} <span className="username">{this.props.user.username}</span></div>
          <div className="timeago">{this.props.user.last_pushed}</div>
        </a>
      </li>
    );
  }
});

React.render(
  <UserList url="/data" />,
  document.getElementById('container')
);
