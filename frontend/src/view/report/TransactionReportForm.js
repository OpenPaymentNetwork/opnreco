
import { binder, binder1 } from '../../util/binder';
import { compose } from '../../util/functional';
import { connect } from 'react-redux';
import {
  setRowsPerPage,
  setPageIndex,
  showRecoType,
} from '../../reducer/report';
import { withStyles } from '@material-ui/core/styles';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import IconButton from '@material-ui/core/IconButton';
import Checkbox from '@material-ui/core/Checkbox';
import Menu from '@material-ui/core/Menu';
import MenuItem from '@material-ui/core/MenuItem';
import PropTypes from 'prop-types';
import React from 'react';
import Select from '@material-ui/core/Select';
import ChevronLeft from '@material-ui/icons/ChevronLeft';
import ChevronRight from '@material-ui/icons/ChevronRight';
import FirstPage from '@material-ui/icons/FirstPage';
import LastPage from '@material-ui/icons/LastPage';
import FilterList from '@material-ui/icons/FilterList';


const styles = {
  root: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
  formControl: {
    fontSize: '1rem',
    margin: '0 16px',
    cursor: 'default',
  },
  formLabel: {
    fontSize: '1rem',
  },
  rowsPerPage: {
    marginLeft: '8px',
  },
};


class TransactionReportForm extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
    dispatch: PropTypes.func.isRequired,
    shownRecoTypes: PropTypes.object,
    pageIndex: PropTypes.number,
    rowsPerPage: PropTypes.number,
    rows: PropTypes.number,
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
    this.props.dispatch(setRowsPerPage(parseInt(event.target.value, 10)));
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
    const {dispatch, rows, rowsPerPage} = this.props;
    dispatch(setPageIndex(Math.floor((rows - 1) / rowsPerPage)));
  }

  handleFilterClick(event) {
    this.setState({filterAnchor: event.currentTarget});
  }

  handleFilterClose() {
    this.setState({filterAnchor: null});
  }

  handleFilterChange(recoType, event) {
    this.props.dispatch(showRecoType(recoType, event.target.checked));
  }

  renderFilterMenu() {
    const {
      classes,
      shownRecoTypes,
    } = this.props;

    const {
      formControl,
    } = classes;

    const {filterAnchor} = this.state;

    return (
      <span>
        <IconButton
          aria-owns={filterAnchor ? 'filter-menu' : null}
          aria-haspopup="true"
          onClick={this.binder(this.handleFilterClick)}
          className={formControl}
        ><FilterList /></IconButton>
        <Menu
          id="filter-menu"
          anchorEl={filterAnchor}
          open={!!filterAnchor}
          onClose={this.binder(this.handleFilterClose)}
        >
          <MenuItem>
            <FormControlLabel
              control={
                <Checkbox checked={!!shownRecoTypes.manual}
                  onChange={this.binder1(this.handleFilterChange, 'manual')} />
              }
              label="Show manually reconciled entries"
            />
          </MenuItem>
          <MenuItem>
            <FormControlLabel
              control={
                <Checkbox checked={!!shownRecoTypes.auto}
                  onChange={this.binder1(this.handleFilterChange, 'auto')} />
              }
              label="Show automatically reconciled entries"
            />
          </MenuItem>
        </Menu>
      </span>
    );
  }

  render() {
    const {
      classes,
      pageIndex,
      rowsPerPage,
      rows,
    } = this.props;

    const {
      formControl,
      formLabel,
    } = classes;

    let rowsInfo;

    if (rows && rows > 0) {
      rowsInfo = (
        <span className={formLabel}>
          {Math.min(rows, (rowsPerPage * pageIndex) + 1)}-
          {Math.min(rows, rowsPerPage * (pageIndex + 1))} of {rows}
        </span>
      );

    } else {
      rowsInfo = <span className={formLabel}>0-0 of 0</span>;
    }

    const navPrev = rows && (pageIndex > 0);
    const navNext = rows && ((pageIndex + 1) * rowsPerPage < rows);

    return (
      <div className={classes.root}>

        <FormControlLabel
          className={formControl}
          control={
            <Select value={String(rowsPerPage)} disableUnderline
              className={classes.rowsPerPage}
              onChange={this.binder(this.handleChangeRowsPerPage)}
            >
              <MenuItem value="10">10</MenuItem>
              <MenuItem value="20">20</MenuItem>
              <MenuItem value="50">50</MenuItem>
              <MenuItem value="100">100</MenuItem>
              <MenuItem value="1000">1000</MenuItem>
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

        {this.renderFilterMenu()}

      </div>
    );
  }
}


function mapStateToProps(state) {
  const {
    shownRecoTypes,
    rowsPerPage,
    pageIndex,
  } = state.report;

  return {
    shownRecoTypes,
    rowsPerPage,
    pageIndex,
  };
}


export default compose(
  withStyles(styles),
  connect(mapStateToProps),
)(TransactionReportForm);
