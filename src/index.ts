import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

import { generateQRCode } from './qr-generator.js';

const server = new Server(
  {
    name: 'chromium-style-qrcode-mcp',
    version: '1.0.1',
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

const GenerateQRCodeSchema = z.object({
  text: z.string().describe('The text to encode in the QR code'),
  showLogo: z
    .boolean()
    .optional()
    .describe('Whether to show the Dino logo in the center (default: true)'),
  customLogo: z
    .string()
    .optional()
    .describe(
      'Base64-encoded image to use as center logo instead of the default Dino. When provided and showLogo is true, this replaces the Dino logo.',
    ),
});

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'generate_qr_code',
        description:
          'Generate a Chromium-style QR code from text. Supports optional Dino logo or custom center image.',
        inputSchema: {
          type: 'object',
          properties: {
            text: {
              type: 'string',
              description: 'The text to encode in the QR code',
            },
            showLogo: {
              type: 'boolean',
              description:
                'Whether to show a center logo (default: true). When true and no customLogo is provided, shows the Chromium Dino logo.',
            },
            customLogo: {
              type: 'string',
              description:
                'Base64-encoded image to use as center logo instead of the default Dino. When provided and showLogo is true, this replaces the Dino logo.',
            },
          },
          required: ['text'],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async request => {
  if (request.params.name === 'generate_qr_code') {
    const { text, showLogo, customLogo } = GenerateQRCodeSchema.parse(
      request.params.arguments,
    );

    try {
      const buffer = await generateQRCode(text, {
        showLogo: showLogo ?? true,
        customLogo,
      });
      const base64 = buffer.toString('base64');

      return {
        content: [
          {
            type: 'image',
            data: base64,
            mimeType: 'image/png',
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error generating QR code: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
        isError: true,
      };
    }
  }

  throw new Error(`Tool not found: ${request.params.name}`);
});

const transport = new StdioServerTransport();
await server.connect(transport);

console.error('QR Code MCP Server running on stdio');
