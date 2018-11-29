
import { binder, binder1 } from './binder';
import { compose } from './functional';
import { connect } from 'react-redux';
import { setRowsPerPage, setPageIndex } from '../reducer/pager';
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


class Pager extends React.Component {
  static propTypes = {
    dispatch: PropTypes.func.isRequired,
    classes: PropTypes.object.isRequired,
    name: PropTypes.string.isRequired,
    rowcount: PropTypes.number,
    pageIndex: PropTypes.number,
    rowsPerPage: PropTypes.number,
  };

  constructor(props) {
    super(props);
    this.binder = binder(this);
    this.binder1 = binder1(this);
    this.state = {
      oldRowcount: null,
    };
  }

  componentDidUpdate() {
    const {rowcount} = this.props;
    if ((rowcount || rowcount === 0) && this.state.oldRowcount !== rowcount) {
      // Keep a memory of the rowcount so this component can continue
      // to display it while switching pages.
      this.setState({oldRowcount: rowcount});
    }
  }

  handleChangeRowsPerPage(event) {
    const value = event.target.value;
    const rowsPerPage = (value === 'none' ? null : parseInt(value, 10));
    this.props.dispatch(setRowsPerPage(this.props.name, rowsPerPage));
  }

  setPageIndex(pageIndex) {
    this.props.dispatch(setPageIndex(this.props.name, pageIndex));
  }

  handleNavFirst() {
    this.setPageIndex(0);
  }

  handleNavPrev() {
    this.setPageIndex(this.props.pageIndex - 1);
  }

  handleNavNext() {
    this.setPageIndex(this.props.pageIndex + 1);
  }

  handleNavLast() {
    const {rowcount, rowsPerPage} = this.props;
    this.setPageIndex(Math.floor(((rowcount || 1) - 1) / rowsPerPage));
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

    const rcount = (
      rowcount || rowcount === 0 ? rowcount : this.state.oldRowcount);

    let rowsInfo;

    if (rcount && rcount > 0) {
      if (!rowsPerPage) {
        rowsInfo = (
          <span className={formLabel}>
            1-{rcount} of {rcount}
          </span>
        );
      } else {
        rowsInfo = (
          <span className={formLabel}>
            {Math.min(rcount, (rowsPerPage * pageIndex) + 1)}-
            {Math.min(rcount, rowsPerPage * (pageIndex + 1))} of {rcount}
          </span>
        );
      }
    } else {
      rowsInfo = <span className={formLabel}>0-0 of 0</span>;
    }

    const navPrev = rowsPerPage && rcount && (pageIndex > 0);
    const navNext = (
      rowsPerPage && rcount && ((pageIndex + 1) * rowsPerPage < rcount));

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
              <MenuItem value="10">10</MenuItem>
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


function mapStateToProps(state, ownProps) {
  const {name, initialRowsPerPage} = ownProps;
  const pagerState = state.pager[name] || {
    rowsPerPage: initialRowsPerPage || 100,
    pageIndex: 0,
  };
  return pagerState;
}


export default compose(
  withStyles(styles),
  connect(mapStateToProps),
)(Pager);
