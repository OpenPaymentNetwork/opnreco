import { clearWithFiles } from '../../reducer/clearmost';
import { closeDrawer, triggerResync } from '../../reducer/app';
import { compose } from '../../util/functional';
import { connect } from 'react-redux';
import { fOPN, selectableURL } from '../../util/fetcher';
import { fetchcache } from '../../reducer/fetchcache';
import { switchProfile } from '../../reducer/login';
import { withRouter } from 'react-router';
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

class ProfileSelector extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
    dispatch: PropTypes.func.isRequired,
    selectable: PropTypes.object,
    profileId: PropTypes.string,
    history: PropTypes.object.isRequired,
  };

  constructor(props) {
    super(props);
    this.state = {
      selectingId: null,
    };
  }

  handleSelect = (event) => {
    const {dispatch} = this.props;

    const profileId = event.target.value;
    this.setState({selectingId: profileId});

    const action1 = fOPN.fetchPath('/token/select/' + profileId);
    dispatch(action1).then(tokenInfo => {
      const token = tokenInfo.access_token;
      // Suspend fetchcache while switching so we don't fetch things while
      // in a transitional state.
      dispatch(fetchcache.suspend());
      dispatch(switchProfile(token, profileId));
      dispatch(clearWithFiles());
      dispatch(triggerResync());
      dispatch(closeDrawer());
      this.props.history.push('/file');
      // Resume fetchcache.
      window.setTimeout(() => {
        dispatch(fetchcache.resume());
      }, 0);
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
          onChange={this.handleSelect}
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
  withRouter,
  connect(mapStateToProps),
)(ProfileSelector);
