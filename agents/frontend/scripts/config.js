/* App configuration */
const LOCAL_API_BASE = 'http://localhost:8000';
const DEPLOYED_API_BASE = 'https://messagevault-920908808510.us-central1.run.app';

function isLocalRuntime() {
	const hostname = window.location.hostname;
	return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '';
}

const API_BASE = isLocalRuntime() ? LOCAL_API_BASE : DEPLOYED_API_BASE;
const APP_NAME = 'planAgent';
const USER_ID = 'default_user';
const ARTIFACT_NAME = 'reentry_plan.md';
