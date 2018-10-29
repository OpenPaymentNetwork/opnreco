
import PropTypes from 'prop-types';
import React from 'react';
import { connect } from 'react-redux';
import { setLayout } from '../../reducer/app';


/* This component configures app.layout in Redux. */

class LayoutConfig extends React.Component {
  static propTypes = {
    dispatch: PropTypes.func.isRequired,
  };

  componentDidMount() {
    const { dispatch, ...layout } = this.props;
    dispatch(setLayout(layout));
    if (layout.title) {
      document.title = layout.title;
    }
  }

  render() {
    return null;
  }
}

export default connect()(LayoutConfig);
