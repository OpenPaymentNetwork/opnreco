
import PropTypes from 'prop-types';
import React from 'react';

// This component renders its children when 'enabled' is true
// and keeps rendering them for a time (default 2 seconds) after
// 'enabled' changes to false.
//
// The Linger component is intended to wrap Dialogs to avoid
// generating their rendered content when they aren't being displayed.
// We have to keep rendering them for a short time after they are closed
// so that transitions will work correctly.
export default class Linger extends React.Component {
  static propTypes = {
    children: PropTypes.any,
    enabled: PropTypes.bool,
    delay: PropTypes.number,
  };

  constructor(props) {
    super(props);
    this.state = {
      // wasEnabled is a delayed copy of props.enabled.
      // We need it because render() is called before componentDidUpdate()
      // and the enabled component should stay enabled until
      // componentDidUpdate() has a chance to start the linger timeout.
      wasEnabled: false,
      // timeout is the linger timeout ID.
      timeout: null,
    };
  }

  componentDidMount() {
    if (this.props.enabled) {
      this.setState({wasEnabled: true});
    }
  }

  componentDidUpdate(prevProps) {
    const oldEnabled = !!prevProps.enabled;
    const newEnabled = !!this.props.enabled;
    if (newEnabled !== oldEnabled) {
      // The enabled state changed.
      const newState = {wasEnabled: newEnabled};
      if (this.state.timeout !== null) {
        // Stop the linger timeout.
        window.clearTimeout(this.state.timeout);
        newState.timeout = null;
      }

      if (!newEnabled) {
        // The enabled state changed from true to false.
        // Start the linger timeout.
        const delay = this.props.delay || 2000;
        newState.timeout = window.setTimeout(
          () => this.setState({timeout: null}), delay);
      }
      this.setState(newState);
    }
  }

  render() {
    if (!this.state.wasEnabled &&
        !this.props.enabled &&
        this.state.timeout === null) {
      // componentDidUpdate() has been called, the children are disabled,
      // and the linger timeout has expired (or never started).
      // Don't render the children.
      return null;
    }

    return <React.Fragment>{this.props.children}</React.Fragment>;
  }
}
