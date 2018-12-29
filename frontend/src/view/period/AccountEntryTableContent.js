
import { binder, binder1 } from '../../util/binder';
import { fOPNReco } from '../../util/fetcher';
import { fetchcache } from '../../reducer/fetchcache';
import { FormattedDate } from 'react-intl';
import { getCurrencyFormatter } from '../../util/currency';
import { withStyles } from '@material-ui/core/styles';
import FormControl from '@material-ui/core/FormControl';
import FormGroup from '@material-ui/core/FormGroup';
import Input from '@material-ui/core/Input';
import PropTypes from 'prop-types';
import React from 'react';
import RecoCheckBox from '../report/RecoCheckBox';


const styles = {
  headCell: {
    padding: '4px 8px',
    fontWeight: 'normal',
    backgroundColor: '#ddd',
    border: '1px solid #bbb',
  },
  amountCell: {
    textAlign: 'right',
    padding: '4px 8px',
    border: '1px solid #bbb',
  },
  textCell: {
    textAlign: 'left',
    padding: '4px 8px',
    border: '1px solid #bbb',
  },
  checkboxCell: {
    textAlign: 'center',
    padding: '0',
    border: '1px solid #bbb',
  },
  columnHeadCell: {
    fontWeight: 'normal',
    textAlign: 'left',
    padding: '4px 8px',
    border: '1px solid #bbb',
  },
};


class AccountEntryTableContent extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
    dispatch: PropTypes.func.isRequired,
    period: PropTypes.object.isRequired,
    statement: PropTypes.object.isRequired,
    entries: PropTypes.array.isRequired,
  };

  constructor(props) {
    super(props);
    this.binder = binder(this);
    this.binder1 = binder1(this);
    this.state = {
      editingEntries: {},  // accountEntryId: true
    };
  }

  renderEntry(entry, cfmt) {
    const {
      classes,
      period,
      dispatch,
    } = this.props;

    return (
      <tr key={entry.id}>
        <td className={classes.textCell}>
          <FormattedDate value={entry.entry_date}
            day="numeric" month="short" year="numeric"
            timeZone="UTC" />
        </td>
        <td className={classes.amountCell}>
          {cfmt(entry.delta)}
        </td>
        <td className={classes.amountCell}>
          {entry.page}
        </td>
        <td className={classes.amountCell}>
          {entry.line}
        </td>
        <td className={classes.textCell}>
          {entry.description}
        </td>
        <td className={classes.checkboxCell}>
          <RecoCheckBox
            periodId={period.id}
            recoId={entry.reco_id}
            accountEntryId={entry.id}
            dispatch={dispatch} />
        </td>
      </tr>);
  }

  render() {
    const {
      classes,
      statement,
      entries,
    } = this.props;

    const rows = [];
    const colCount = 6;

    const cfmt = new getCurrencyFormatter(statement.currency);

    for (const entry of entries) {
      rows.push(this.renderEntry(entry, cfmt));
    }

    return (
      <React.Fragment>
        <thead>
          <tr>
            <th className={classes.headCell}
              colSpan={colCount}
            >
              Account Entries
            </th>
          </tr>
          <tr>
            <th className={classes.columnHeadCell} width="15%">
              Date
            </th>
            <th className={classes.columnHeadCell} width="10%">
              Amount
            </th>
            <th className={classes.columnHeadCell} width="5%">
              Page
            </th>
            <th className={classes.columnHeadCell} width="5%">
              Line
            </th>
            <th className={classes.columnHeadCell} width="60%">
              Description
            </th>
            <th className={classes.columnHeadCell} width="5%">
              Reconciled
            </th>
          </tr>
        </thead>
        <tbody>
          {rows}
        </tbody>
      </React.Fragment>
    );
  }
}


export default withStyles(styles)(AccountEntryTableContent);
