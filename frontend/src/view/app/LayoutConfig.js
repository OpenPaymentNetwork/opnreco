
import PropTypes from 'prop-types';
import React from 'react';
import { connect } from 'react-redux';
import { setLayout } from '../../reducer/app';


/* This component configures app.layout in Redux. */

class LayoutConfig extends React.Component {
  static propTypes = {
    setLayout: PropTypes.object.isRequired,
  };

  componentDidMount() {
    const { setLayout, ...layout } = this.props;
    setLayout(layout);
  }

  render() {
    return null;
  }
}


const dispatchToProps = {
  setLayout,
};


export default connect(null, dispatchToProps)(LayoutConfig);
