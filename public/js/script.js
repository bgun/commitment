'use strict';

var UserList = React.createClass({
  getInitialState: function() {
    return {
      data: []
    };
  },
  componentDidMount: function() {
    $.ajax({
      url: this.props.url,
      dataType: 'json',
      success: function(data) {
        console.log(data);
        this.setState({data: data});
      }.bind(this),
      error: function(xhr, status, err) {
        console.error(this.props.url, status, err.toString());
      }.bind(this)
    });
  },
  render: function() {
    var userNodes = function() {
      this.props.data.map(function(user) {
        return (
          <Comment>
            {this.props.name}
          </Comment>
        );
      });
    };
    return (
      <ul className="user-list">
        <h1>Users</h1>
        {userNodes}
      </ul>
    );
  }
});

var User = React.createClass({
  render: function() {
    return (
      <li className="user">
        {this.props.name}
      </li>
    );
  }
});

React.render(
  <UserList url="/data" />,
  document.getElementById('container')
);
