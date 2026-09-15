import { withPayload } from '@payloadcms/next/withPayload';
import type { NextConfig } from 'next';

const config: NextConfig = { poweredByHeader: false, agentRules: false };
export default withPayload(config);
