<?php
/**
 * Panth_React CORS plugin.
 *
 * @copyright Copyright (c) Panth. All rights reserved.
 */
declare(strict_types=1);

namespace Panth\React\Plugin\Cors;

use Magento\Framework\App\Config\ScopeConfigInterface;
use Magento\Framework\App\RequestInterface;
use Magento\Framework\App\ResponseInterface;
use Magento\GraphQl\Controller\GraphQl;
use Magento\Store\Model\ScopeInterface;

/**
 * Wraps \Magento\GraphQl\Controller\GraphQl::dispatch and, when the incoming
 * Origin header matches the configured allow list, writes strict CORS response
 * headers. Scoped to the GraphQL endpoint only - all other routes are
 * untouched.
 */
final class AddCorsHeaders
{
    /**
     * System config path: module enable flag.
     */
    private const XML_PATH_ENABLED = 'panth_react/frontend/enabled';

    /**
     * System config path: newline-separated CORS allow list.
     */
    private const XML_PATH_ALLOWED_ORIGINS = 'panth_react/frontend/cors_allowed_origins';

    /**
     * GraphQL endpoint path fragment. We only touch responses for this route.
     */
    private const GRAPHQL_PATH_FRAGMENT = '/graphql';

    /**
     * @param ScopeConfigInterface $scopeConfig
     * @param RequestInterface $request
     */
    public function __construct(
        private readonly ScopeConfigInterface $scopeConfig,
        private readonly RequestInterface $request
    ) {
    }

    /**
     * Decorate the GraphQL response with CORS headers when the Origin is
     * on the allow list.
     *
     * @param GraphQl $subject
     * @param ResponseInterface $result
     * @return ResponseInterface
     */
    public function afterDispatch(GraphQl $subject, ResponseInterface $result): ResponseInterface
    {
        if (!$this->isEnabled()) {
            return $result;
        }

        if (!$this->isGraphQlRequest()) {
            return $result;
        }

        $origin = $this->getOriginHeader();
        if ($origin === '' || !$this->isOriginAllowed($origin)) {
            return $result;
        }

        $result->setHeader('Access-Control-Allow-Origin', $origin, true);
        $result->setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS', true);
        $result->setHeader(
            'Access-Control-Allow-Headers',
            'Content-Type, Authorization, Store, X-Requested-With',
            true
        );
        $result->setHeader('Access-Control-Allow-Credentials', 'true', true);
        $result->setHeader('Vary', 'Origin', true);

        return $result;
    }

    /**
     * Check whether the module is enabled for the current store scope.
     *
     * @return bool
     */
    private function isEnabled(): bool
    {
        return $this->scopeConfig->isSetFlag(
            self::XML_PATH_ENABLED,
            ScopeInterface::SCOPE_STORE
        );
    }

    /**
     * Determine whether the current request targets the GraphQL endpoint.
     *
     * @return bool
     */
    private function isGraphQlRequest(): bool
    {
        $path = (string) $this->request->getPathInfo();
        if ($path === '') {
            $path = (string) $this->request->getRequestUri();
        }

        return $path !== '' && str_contains($path, self::GRAPHQL_PATH_FRAGMENT);
    }

    /**
     * Read the Origin header from the current request.
     *
     * @return string
     */
    private function getOriginHeader(): string
    {
        $origin = $this->request->getHeader('Origin');

        return is_string($origin) ? trim($origin) : '';
    }

    /**
     * Test whether the supplied origin is explicitly allowed.
     *
     * @param string $origin
     * @return bool
     */
    private function isOriginAllowed(string $origin): bool
    {
        $configured = (string) $this->scopeConfig->getValue(
            self::XML_PATH_ALLOWED_ORIGINS,
            ScopeInterface::SCOPE_STORE
        );
        if ($configured === '') {
            return false;
        }

        $allowed = [];
        foreach (preg_split('/\r\n|\r|\n/', $configured) ?: [] as $line) {
            $line = trim((string) $line);
            if ($line !== '' && $line !== '*') {
                $allowed[] = $line;
            }
        }

        return in_array($origin, $allowed, true);
    }
}
