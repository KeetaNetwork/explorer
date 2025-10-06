import '@/app/_styles/globals.css';

import { render } from 'preact';

import MainLayout from './components/layout/MainLayout';
import Providers from './components/Providers';

export function App() {
	return (
		<Providers>
			<MainLayout />
		</Providers>
	);
}

render(<App />, document.getElementById('app')!);
