
import { compose } from '../../util/functional';
import { connect } from 'react-redux';
import { fOPNReco } from '../../util/fetcher';
import { withStyles } from '@material-ui/core/styles';
import PropTypes from 'prop-types';
import React from 'react';
import Checkbox from '@material-ui/core/Checkbox';
import FormControlLabel from '@material-ui/core/FormControlLabel';
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


class ShowNonCircCard extends React.Component {
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

  handleChange = (event, checked) => {
    const {dispatch} = this.props;
    const action = fOPNReco.fetchPath(
      '/set-show-non-circ', {data: {show_non_circ_with_circ: checked}});
    this.setState({saving: true});
    dispatch(action).then((settings) => {
      this.props.updateSettings(settings);
      this.setState({saving: false});
    }).finally(() => {
      this.setState({saving: false});
    });
  }

  render() {
    const {classes, settings} = this.props;
    const {saving} = this.state;

    return (
      <Card className={classes.card}>
        <CardContent className={classes.cardContent}>
          <Typography variant="h6">
            Reconcile Both Non-Circulation and Circulation
          </Typography>
          <Typography variant="body2">
            Reconciliation of non-circulation accounts is normally
            disabled if you have a circulation account. Enable
            this feature to reconcile both types of accounts.
          </Typography>
          <Typography variant="body1" component="div">
            <FormControlLabel
              control={
                <Checkbox
                  checked={settings.show_non_circ_with_circ}
                  onChange={this.handleChange}
                />
              }
              label={
                <span>
                  Reconcile both non-circulation and circulation
                  accounts {saving &&
                    <CircularProgress
                      size="12px"
                      className={classes.progress} />
                  }
                </span>
              }
              disabled={saving}
            />
          </Typography>
        </CardContent>
      </Card>
    );
  }
}

export default compose(
  withStyles(styles),
  connect(),
)(ShowNonCircCard);
