import { binder } from '../../util/binder';
import { clearMost } from '../../reducer/clearmost';
import { closeDrawer, triggerResync } from '../../reducer/app';
import { compose } from '../../util/functional';
import { connect } from 'react-redux';
import { fOPN } from '../../util/fetcher';
import { fetchcache } from '../../reducer/fetchcache';
import { switchProfile } from '../../reducer/login';
import { withStyles } from '@material-ui/core/styles';
import CircularProgress from '@material-ui/core/CircularProgress';
import MenuItem from '@material-ui/core/MenuItem';
import PropTypes from 'prop-types';
import React from 'react';
import Require from '../../util/Require';
import Select from '@material-ui/core/Select';


const styles = {
  root: {
    display: 'flex',
    padding: '0 8px',
  },
  select: {
    color: '#fff',
    flexGrow: '1',
    width: '100%',
  },
  selectInSelect: {
    // Work around https://github.com/mui-org/material-ui/issues/13262
    '&:-moz-focusring': {
      color: '#fff',
    },
  },
  iconInSelect: {
    color: '#fff',
  },
  spinner: {
    paddingRight: '16px',
  },
};

const selectableURL = fOPN.pathToURL('/token/selectable');


class ProfileSelector extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
    dispatch: PropTypes.func.isRequired,
    selectable: PropTypes.object,
    profileId: PropTypes.string,
  };

  constructor(props) {
    super(props);
    this.binder = binder(this);
    this.state = {
      selectingId: null,
    };
  }

  handleSelect(event) {
    const {dispatch} = this.props;

    const profileId = event.target.value;
    this.setState({selectingId: profileId});

    const action1 = fOPN.fetchPath('/token/select/' + profileId);
    let token;
    dispatch(action1).then(tokenInfo => {
      token = tokenInfo.access_token;
      const action2 = fOPN.fetchPath('/me', {
        token,
        disableRefresh: true,
      });
      return dispatch(action2);
    }).then(profileInfo => {
      dispatch(switchProfile(token, profileInfo.id));
      dispatch(clearMost());
      dispatch(triggerResync());
      dispatch(closeDrawer());
    }).finally(() => {
      this.setState({selectingId: null});
    });
  }

  render() {
    const {profileId, selectable, classes} = this.props;
    const {selectingId} = this.state;
    const profiles = (
      selectable && selectable.profiles ? selectable.profiles : []);
    let spinner;

    if (selectingId) {
      spinner = (
        <div className={classes.spinner}>
          <CircularProgress size={24} color="secondary" />
        </div>
      );
    } else {
      spinner = null;
    }

    return (
      <div className={classes.root}>
        <Require fetcher={fOPN} urls={[selectableURL]} />
        {spinner}
        <Select
          value={selectingId || profileId}
          onChange={this.binder(this.handleSelect)}
          className={classes.select}
          classes={{
            select: classes.selectInSelect,
            icon: classes.iconInSelect,
          }}
          inputProps={{classes: {root: classes.selectInput}}}
          disableUnderline
        >
          {profiles.map(p => {
            let title = p.title;
            if (p.username) {
              title = <span>{p.title} (<em>{p.username}</em>)</span>;
            }
            return <MenuItem key={p.id} value={p.id}>{title}</MenuItem>;
          })}
        </Select>
      </div>
    );
  }
}


function mapStateToProps(state) {
  return {
    selectableURL,
    selectable: fetchcache.get(state, selectableURL),
    profileId: state.login.id,
  };
}

export default compose(
  withStyles(styles),
  connect(mapStateToProps),
)(ProfileSelector);
