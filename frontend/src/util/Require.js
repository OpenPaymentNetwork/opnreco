
import PropTypes from 'prop-types';
import React from 'react';
import { connect } from 'react-redux';
import { fetchcache } from '../reducer/fetchcache';


let nextComponentId = 1000;


/* Require is an invisible component that declares which URLs should be
 * in the fetch cache. The fetcher prop is required, along with either
 * the paths prop (an array) or the urls prop (an array).
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

function mapStateToProps(state) {
  // Inject the 'suspended' prop (even Require doesn't use it)
  // so that changing 'suspended' triggers repopulation of the requirements.
  const {suspended} = state.fetchcache;
  return {suspended};
}

export default connect(mapStateToProps)(Require);
