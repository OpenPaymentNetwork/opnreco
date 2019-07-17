
import PropTypes from 'prop-types';
import React from 'react';
import { withStyles } from '@material-ui/core/styles';


/* global process: false */
const publicURL = process.env.REACT_APP_OPN_PUBLIC_URL;


const styles = theme => ({
  root: {
    color: theme.palette.primary.main,
    textDecoration: 'none',
    '&:hover': {
      textDecoration: 'underline',
    },
  },
});


class ProfileLink extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
    id: PropTypes.string,
    title: PropTypes.string,
    profiles: PropTypes.object,
  };

  render() {
    const {id, title, profiles, classes} = this.props;

    if (!id) {
      return <span>{title || '[Unspecified Profile]'}</span>;
    }

    // Prefer the title/username from the peers object.
    let text = title;
    let path = `p/${id}`;
    const profile = profiles ? profiles[id] : null;
    if (profile && profile.title) {
      const username = profile.username;
      if (username) {
        text = <span>{profile.title} (<em>{username}</em>)</span>;
        // path = username;
      } else {
        text = profile.title;
      }
    }

    if (!text) {
      text = `[Profile ${id}]`;
    }

    return (
      <a className={classes.root}
        href={`${publicURL}/${path}`}
        target="_blank" rel="noopener noreferrer">{text}</a>
    );
  }
}

export default withStyles(styles)(ProfileLink);
