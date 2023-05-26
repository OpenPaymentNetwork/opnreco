
import Button from '@material-ui/core/Button';
import FileEdit from './FileEdit';
import FilePeriods from './FilePeriods';
import FileLoopTable from './FileLoopTable';
import Paper from '@material-ui/core/Paper';
import PropTypes from 'prop-types';
import React from 'react';


export default class FileTabContent extends React.Component {
  static propTypes = {
    file: PropTypes.object,
    tab: PropTypes.string,
  };

  constructor(props) {
    super(props);
    this.state = {
      errorTab: null,
    };
  }

  componentDidCatch(error, info) {
    /* eslint {"no-console": 0} */
    const { file, tab } = this.props;

    if (typeof console !== 'undefined') {
      console.error(
        'FileTabContent render error',
        { error, info, file, tab });
    }
    this.setState({ errorTab: this.props.tab });
  }

  componentDidUpdate(prevProps) {
    if (this.state.errorTab && prevProps.tab !== this.props.tab) {
      // Clear the error.
      this.setState({ errorTab: null });
    }
  }

  handleTryAgain = () => {
    this.setState({ errorTab: null });
  };

  render() {
    const { errorTab } = this.state;
    if (errorTab && errorTab === this.props.tab) {
      return (
        <div style={{ margin: 16 }}>
          <Paper style={{ padding: 16 }}>
            Sorry, something went wrong while rendering this component.
            See the developer console for more info.
            <p>
              <Button variant="outlined"
                onClick={this.handleTryAgain}
              >
                Try Again
              </Button>
            </p>
          </Paper>
        </div>
      );
    }

    const { file, tab } = this.props;
    switch (tab) {
      case 'edit':
        return <FileEdit file={file} />;
      case 'designs':
        return <FileLoopTable file={file} />;
      case 'periods':
        return <FilePeriods file={file} />;
      default:
        return null;
    }
  }
}
