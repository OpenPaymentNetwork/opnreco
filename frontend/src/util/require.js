
import React from 'react';
import PropTypes from 'prop-types';
import { fetchcache } from '../reducer/fetchcache';
import { OPNAPI, OPNReportAPI } from './fetcher';
import { connect } from 'react-redux';


let nextComponentId = 1000;


/* Require is an invisible component that declares which URLs should be
 * in the fetch cache.
 */
export class Require extends React.Component {
  static propTypes = {
    dispatch: PropTypes.func.isRequired,
    fetcher: PropTypes.object.isRequired,
    paths: PropTypes.array,
    urls: PropTypes.array,
    options: PropTypes.object,
  };

  constructor(props) {
    super(props);
    this.state = { componentId: String(nextComponentId) };
    nextComponentId += 1;
  }

  componentDidMount() {
    this.handleProps();
  }

  componentDidUpdate() {
    this.handleProps();
  }

  componentWillUnmount() {
    const {dispatch} = this.props;
    dispatch(fetchcache.require(this.state.componentId, []));
  }

  handleProps() {
    const {dispatch, fetcher, paths, options} = this.props;

    let urls;
    if (paths) {
      urls = paths.map(path => fetcher.pathToURL(path));
    } else {
      urls = this.props.urls;
    }

    dispatch(fetchcache.require(
      this.state.componentId, fetcher, urls, options));
  }

  render() {
    return null;
  }
}


function withFetcher(fetcher) {
  // Inject the fetcher through the mapStateToProps function provided
  // to the connect() function.
  // Also inject the 'suspended' prop (even though it isn't used)
  // so that changing 'suspended' triggers repopulation of the requirements.
  function mapStateToProps(state) {
    const {suspended} = state.fetchcache;
    return {suspended, fetcher};
  }
  return connect(mapStateToProps);
}


/* RequireFromOPN and RequireFromOPNReport declare the fetcher. */

export const RequireFromOPN = withFetcher(OPNAPI)(Require);

export const RequireFromOPNReport = withFetcher(OPNReportAPI)(Require);
