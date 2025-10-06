/* eslint-disable react/display-name */
import Streaming, { type StreamingProps } from '.';

type WithStreamingProps = Pick<StreamingProps, 'errorFallback' | 'loadingFallback'>;

const withStreaming = <P extends object>
(
	Component: React.ComponentType<P>,
	streamingProps: WithStreamingProps = {}
): React.FC<P> => (props) => {
	const { errorFallback = <div>Something went wrong</div>, loadingFallback } = streamingProps;
	return(<Streaming errorFallback={errorFallback} loadingFallback={loadingFallback}>
		<Component {...props} />
	</Streaming>);
};

export default withStreaming;
