
import LayoutConfig from '../app/LayoutConfig';
import OPNAppBar from './OPNAppBar';
import React from 'react';


export default class Redirecting extends React.Component {
  render() {
    return (
      <div>
        <LayoutConfig title="Redirecting&hellip;" />
        <OPNAppBar />
      </div>
    );
  }
}
