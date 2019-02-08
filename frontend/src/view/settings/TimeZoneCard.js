
import { compose } from '../../util/functional';
import { connect } from 'react-redux';
import { fOPNReco } from '../../util/fetcher';
import { withStyles } from '@material-ui/core/styles';
import PropTypes from 'prop-types';
import React from 'react';
import Select from '@material-ui/core/Select';
import Card from '@material-ui/core/Card';
import CardContent from '@material-ui/core/CardContent';
import CircularProgress from '@material-ui/core/CircularProgress';
import Typography from '@material-ui/core/Typography';


const styles = {
  card: {
    marginBottom: '16px',
  },
  cardContent: {
    paddingBottom: 0,
  },
  progress: {
    marginLeft: '16px',
  },
};


class TimeZoneCard extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
    dispatch: PropTypes.func.isRequired,
    settings: PropTypes.object,
    updateSettings: PropTypes.func.isRequired,
  };

  constructor(props) {
    super(props);
    this.state = {
      saving: false,
    };
  }

  handleChange = (event) => {
    const {value} = event.target;
    if (value !== this.props.settings.tzname) {
      const {dispatch} = this.props;
      const action = fOPNReco.fetchPath(
        '/set-tzname', {data: {tzname: event.target.value}});
      this.setState({saving: true});
      dispatch(action).then((settings) => {
        this.props.updateSettings(settings);
        this.setState({saving: false});
      }).finally(() => {
        this.setState({saving: false});
      });
    }
  }

  render() {
    const {classes, settings} = this.props;
    const {saving} = this.state;

    return (
      <Card className={classes.card}>
        <CardContent className={classes.cardContent}>
          <Typography variant="h6">
            Time Zone
          </Typography>
          <Typography variant="body2">
            Update this setting to match the time zone of your financial
            institution. It will help align OPN movements with
            account entries. Note: most financial institutions in
            the United States generate statements based on
            the <em>America/New_York</em> time zone.
          </Typography>
          <Typography variant="body1" component="div">
            <Select
              name="tzname"
              value={settings.tzname}
              onChange={this.handleChange}
              disabled={saving}
              native
            >
              {settings.tznames.map(tzname => (
                <option key={tzname} value={tzname}>{tzname}</option>
              ))}
            </Select> {saving ?
              <CircularProgress size="12px" className={classes.progress} />
              : null}
          </Typography>
        </CardContent>
      </Card>
    );
  }
}

export default compose(
  withStyles(styles),
  connect(),
)(TimeZoneCard);
