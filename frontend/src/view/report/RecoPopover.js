
import { binder } from '../../util/binder';
import { closeRecoPopover } from '../../reducer/report';
import { compose } from '../../util/functional';
import { connect } from 'react-redux';
import { withStyles } from '@material-ui/core/styles';
import PropTypes from 'prop-types';
import React from 'react';
import Checkbox from '@material-ui/core/Checkbox';
import Typography from '@material-ui/core/Typography';
import Popover from '@material-ui/core/Popover';
import Fade from '@material-ui/core/Fade';


const styles = theme => ({
  popoverContent: {
    minWidth: '400px',
  },
  titleBar: {
    backgroundColor: theme.palette.primary.main,
    color: '#fff',
    height: '32px',
    lineHeight: '32px',
    padding: '0 16px',
    fontSize: '1.0rem',
  },
  content: {
    padding: '16px',
  },
  table: {
    borderCollapse: 'collapse',
    width: '100%',
  },
  headCell: {
    border: '1px solid #bbb',
    backgroundColor: '#ddd',
    fontWeight: 'normal',
  },
  head2Cell: {
    border: '1px solid #bbb',
    fontWeight: 'normal',
  },
  spaceRow: {
    height: '16px',
  },
  cell: {
    border: '1px solid #bbb',
  },
  addCell: {
    border: '1px solid #bbb',
  },
  checkCell: {
    border: '1px solid #bbb',
    textAlign: 'center',
  },
});


class RecoPopover extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
    dispatch: PropTypes.func.isRequired,
    open: PropTypes.bool,
    anchorEl: PropTypes.object,
  };

  constructor(props) {
    super(props);
    this.binder = binder(this);
  }

  handleClose() {
    this.props.dispatch(closeRecoPopover());
  }

  renderTable() {
    const {
      classes,
    } = this.props;

    return (
      <table className={classes.table}>
        <tbody>
          <tr>
            <th colSpan="4" className={classes.headCell}>Movements</th>
          </tr>
          <tr>
            <th width="10%" className={classes.checkCell}>
              <input type="checkbox" />
            </th>
            <th width="25%" className={classes.head2Cell}>Amount</th>
            <th width="25%" className={classes.head2Cell}>Date and Time</th>
            <th width="30%" className={classes.head2Cell}>Transfer</th>
          </tr>
          <tr>
            <td colSpan="4" className={classes.addCell}></td>
          </tr>
          <tr>
            <td colSpan="4" className={classes.spaceRow}></td>
          </tr>
          <tr>
            <th colSpan="4"className={classes.headCell}>Account Entries</th>
          </tr>
          <tr>
            <th width="10%" className={classes.checkCell}>
              <input type="checkbox" />
            </th>
            <th width="25%" className={classes.head2Cell}>Amount</th>
            <th width="25%" className={classes.head2Cell}>Date</th>
            <th width="30%" className={classes.head2Cell}>Description</th>
          </tr>
          <tr>
            <td colSpan="4" className={classes.addCell}></td>
          </tr>
        </tbody>
      </table>
    );
  }

  render() {
    const {
      classes,
      open,
      anchorEl,
    } = this.props;

    return (
      <Popover
        id="reco-popover"
        open={open}
        anchorEl={anchorEl}
        onClose={this.binder(this.handleClose)}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        TransitionComponent={Fade}
      >
        <div className={classes.popoverContent}>
          <Typography variant="h6" className={classes.titleBar}>
            Reconciliation
          </Typography>
          <Typography className={classes.content} component="div">
            {this.renderTable()}
          </Typography>
        </div>
      </Popover>
    );
  }
}


function mapStateToProps(state) {
  return state.report.recoPopover;
}


export default compose(
  withStyles(styles, {withTheme: true}),
  connect(mapStateToProps),
)(RecoPopover);
