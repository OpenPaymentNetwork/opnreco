
import { clearForSettings } from '../../reducer/clearmost';
import { compose } from '../../util/functional';
import { connect } from 'react-redux';
import { fetchcache } from '../../reducer/fetchcache';
import { fOPNReco, settingsURL } from '../../util/fetcher';
import { withRouter } from 'react-router';
import { withStyles } from '@material-ui/core/styles';
import LayoutConfig from '../app/LayoutConfig';
import OPNAppBar from '../app/OPNAppBar';
import PropTypes from 'prop-types';
import React from 'react';
import Card from '@material-ui/core/Card';
import CardContent from '@material-ui/core/CardContent';
import CircularProgress from '@material-ui/core/CircularProgress';
import Require from '../../util/Require';
import TimeZoneCard from './TimeZoneCard';


const styles = {
  content: {
    padding: '16px',
    minWidth: '300px',
    maxWidth: '800px',
    marginLeft: 'auto',
    marginRight: 'auto',
  },
};


class Settings extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
    dispatch: PropTypes.func.isRequired,
    history: PropTypes.object.isRequired,
    settings: PropTypes.object,
    loading: PropTypes.bool,
  };

  updateSettings = (settings) => {
    const { dispatch } = this.props;
    dispatch(clearForSettings());
    dispatch(fetchcache.inject(settingsURL, settings));
  };

  render() {
    const {
      classes,
      settings,
      loading,
    } = this.props;

    const cards = [];

    if (loading) {
      cards.push(
        <Card key="loading">
          <CardContent>
            <CircularProgress />
          </CardContent>
        </Card>
      );
    } else if (settings) {
      const updateSettings = this.updateSettings;

      cards.push(
        <TimeZoneCard
          key="tz"
          settings={settings}
          updateSettings={updateSettings}
        />);
    }

    return (
      <div className={classes.root}>
        <Require urls={[settingsURL]} fetcher={fOPNReco} />
        <LayoutConfig title="Settings" />

        <OPNAppBar />

        <div className={classes.content}>
          {cards}
        </div>
      </div>
    );
  }
}

function mapStateToProps(state) {
  const settings = fetchcache.get(state, settingsURL);
  const loading = fetchcache.fetching(state, settingsURL);
  return {
    settingsURL,
    settings,
    loading,
  };
}


export default compose(
  withStyles(styles),
  withRouter,
  connect(mapStateToProps),
)(Settings);
