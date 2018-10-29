
import { binder, binder1 } from '../../util/binder';
import { compose } from '../../util/functional';
import { connect } from 'react-redux';
import { setRowsPerPage, setPageIndex } from '../../reducer/report';
import { withStyles } from '@material-ui/core/styles';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import IconButton from '@material-ui/core/IconButton';
import MenuItem from '@material-ui/core/MenuItem';
import PropTypes from 'prop-types';
import React from 'react';
import Select from '@material-ui/core/Select';
import ChevronLeft from '@material-ui/icons/ChevronLeft';
import ChevronRight from '@material-ui/icons/ChevronRight';
import FirstPage from '@material-ui/icons/FirstPage';
import LastPage from '@material-ui/icons/LastPage';


const styles = {
  root: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
  formControl: {
    fontSize: '0.9rem',
    margin: '0 16px',
    cursor: 'default',
  },
  formLabel: {
    fontSize: '0.9rem',
  },
  rowsPerPage: {
    marginLeft: '8px',
  },
  rowsPerPageSelect: {
    fontSize: '0.9rem',
    paddingRight: '24px',
  },
};


class TransactionReportForm extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
    dispatch: PropTypes.func.isRequired,
    pageIndex: PropTypes.number,
    rowsPerPage: PropTypes.number,
    rowcount: PropTypes.number,
  };

  constructor(props) {
    super(props);
    this.binder = binder(this);
    this.binder1 = binder1(this);
    this.state = {
      filterAnchor: null,
    };
  }

  handleChangeRowsPerPage(event) {
    const value = event.target.value;
    const rowsPerPage = (value === 'none' ? null : parseInt(value, 10));
    this.props.dispatch(setRowsPerPage(rowsPerPage));
  }

  handleNavFirst() {
    this.props.dispatch(setPageIndex(0));
  }

  handleNavPrev() {
    this.props.dispatch(setPageIndex(this.props.pageIndex - 1));
  }

  handleNavNext() {
    this.props.dispatch(setPageIndex(this.props.pageIndex + 1));
  }

  handleNavLast() {
    const {dispatch, rowcount, rowsPerPage} = this.props;
    dispatch(setPageIndex(Math.floor((rowcount - 1) / rowsPerPage)));
  }

  render() {
    const {
      classes,
      pageIndex,
      rowsPerPage,
      rowcount,
    } = this.props;

    const {
      formControl,
      formLabel,
    } = classes;

    let rowsInfo;

    if (rowcount && rowcount > 0) {
      if (!rowsPerPage) {
        rowsInfo = (
          <span className={formLabel}>
            1-{rowcount} of {rowcount}
          </span>
        );
      } else {
        rowsInfo = (
          <span className={formLabel}>
            {Math.min(rowcount, (rowsPerPage * pageIndex) + 1)}-
            {Math.min(rowcount, rowsPerPage * (pageIndex + 1))} of {rowcount}
          </span>
        );
      }
    } else {
      rowsInfo = <span className={formLabel}>0-0 of 0</span>;
    }

    const navPrev = rowsPerPage && rowcount && (pageIndex > 0);
    const navNext = (
      rowsPerPage && rowcount && ((pageIndex + 1) * rowsPerPage < rowcount));

    return (
      <div className={classes.root}>

        <FormControlLabel
          className={formControl}
          control={
            <Select value={rowsPerPage ? String(rowsPerPage) : 'none'}
              disableUnderline
              className={classes.rowsPerPage}
              classes={{select: classes.rowsPerPageSelect}}
              onChange={this.binder(this.handleChangeRowsPerPage)}
            >
              <MenuItem value="100">100</MenuItem>
              <MenuItem value="1000">1,000</MenuItem>
              <MenuItem value="10000">10,000</MenuItem>
              <MenuItem value="none">All</MenuItem>
            </Select>
          }
          label={<span className={formLabel}>Rows per page:</span>}
          labelPlacement="start"
        />

        <FormControlLabel
          className={formControl}
          control={<input type="hidden" />}
          label={rowsInfo} />

        <IconButton title="First Page"
          disabled={!navPrev} onClick={this.binder(this.handleNavFirst)}
        ><FirstPage/></IconButton>

        <IconButton title="Previous Page"
          disabled={!navPrev} onClick={this.binder(this.handleNavPrev)}
        ><ChevronLeft/></IconButton>

        <IconButton title="Next Page"
          disabled={!navNext} onClick={this.binder(this.handleNavNext)}
        ><ChevronRight/></IconButton>

        <IconButton title="Last Page"
          disabled={!navNext} onClick={this.binder(this.handleNavLast)}
        ><LastPage/></IconButton>

      </div>
    );
  }
}


function mapStateToProps(state) {
  const {
    rowsPerPage,
    pageIndex,
  } = state.report;

  return {
    rowsPerPage,
    pageIndex,
  };
}


export default compose(
  withStyles(styles),
  connect(mapStateToProps),
)(TransactionReportForm);
