
import { withStyles } from '@material-ui/core/styles';
import Button from '@material-ui/core/Button';
import CircularProgress from '@material-ui/core/CircularProgress';
import FormGroup from '@material-ui/core/FormGroup';
import Paper from '@material-ui/core/Paper';
import PropTypes from 'prop-types';
import React from 'react';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';


const styles = {
  content: {
    padding: '16px',
    maxWidth: '800px',
    margin: '16px auto',
  },
  field: {
    margin: '16px 16px 16px 0',
    minWidth: '250px',
  },
  button: {
    margin: '16px 16px 16px 0',
  },
  progress: {
    marginLeft: '16px',
  },
  addTopLine: {
    marginTop: '0',
  },
};


class FileAddForm extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
    dispatch: PropTypes.func.isRequired,
    history: PropTypes.object.isRequired,
    onCancel: PropTypes.func,
  };

  constructor(props) {
    super(props);
    this.state = {
      form: {},
    };
  }

  handleChangeText = (event, fieldName) => {
    this.setState({
      form: {
        ...this.state.form,
        [fieldName]: event.target.value,
      },
    });
  }

  render() {
    const {
      classes,
      onCancel
    } = this.props;

    const {
      form,
      saving,
    } = this.state;

    let spinner = null;
    if (saving) {
      spinner = <CircularProgress size="24px" className={classes.progress} />;
    }

    let topLine;
    let buttons;
    buttons = (
      <FormGroup row>
        <Button
          className={classes.button}
          color="primary"
          variant="contained"
          onClick={this.handleSave}
        >
          Add
        </Button>

        {onCancel ?
          <Button
            className={classes.button}
            variant="contained"
            onClick={this.props.onCancel}
          >
            Cancel
          </Button>
          : null}

        {spinner}
      </FormGroup>
    );

    topLine = (
      <Typography variant="h6" className={classes.addTopLine}>
        Add a File
      </Typography>
    );


    return (
      <Paper className={classes.content}>
        <form className={classes.form} noValidate>
          <FormGroup row>
            {topLine}
          </FormGroup>

          <FormGroup row>

            <TextField
              id="start_date"
              label="Start Date"
              type="date"
              value={form.start_date || ''}
              onChange={(event) => this.handleChangeText(event, 'start_date')}
              className={classes.field}
              InputLabelProps={{
                shrink: true,
              }}
            />

            <TextField
              id="end_date"
              label="End Date"
              type="date"
              value={form.end_date || ''}
              onChange={(event) => this.handleChangeText(event, 'end_date')}
              className={classes.field}
              InputLabelProps={{
                shrink: true,
              }}
            />
          </FormGroup>

          {buttons}
        </form>
      </Paper>
    );
  }
}

export default withStyles(styles)(FileAddForm);
