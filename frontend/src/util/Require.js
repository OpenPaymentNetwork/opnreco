
import PropTypes from 'prop-types';
import React from 'react';
import { connect } from 'react-redux';
import { fetchcache } from '../reducer/fetchcache';


let nextComponentId = 1000;


/* Require is an invisible component that declares which URLs should be
 * in the fetch cache. The fetcher prop is required, along with either
 * the paths prop (an array) or the urls prop (an array).
 */
class Require extends React.Component {
  static propTypes = {
    dispatch: PropTypes.func.isRequired,
    fetcher: PropTypes.object,
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
    // The component is mounted and the requirements have been
    // specified (or updated), so call fetchcache.require() to
    // start any needed fetches.
    const {dispatch, fetcher, paths, options} = this.props;

    let urls;
    if (paths) {
      if (fetcher) {
        urls = paths.map(path => fetcher.pathToURL(path));
      } else {
        throw new Error(
          'The Require component needs a fetcher when paths are given');
      }
    } else {
      urls = this.props.urls;
    }

    // Add the fetcher to the options.
    const fetchcacheOptions = {
      ...(options || {}),
      fetcher,
    };

    dispatch(fetchcache.require(
      this.state.componentId, urls, fetchcacheOptions));
  }

  render() {
    return null;
  }
}

function mapStateToProps(state) {
  // Inject the 'suspended' prop (even though Require doesn't use it)
  // so that changing 'suspended' triggers repopulation of the requirements.
  const {suspended} = state.fetchcache;
  return {suspended};
}

export default connect(mapStateToProps)(Require);
