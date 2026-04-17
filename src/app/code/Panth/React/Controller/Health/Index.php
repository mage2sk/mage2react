<?php
/**
 * Panth_React health endpoint.
 *
 * @copyright Copyright (c) Panth. All rights reserved.
 */
declare(strict_types=1);

namespace Panth\React\Controller\Health;

use Magento\Framework\App\Action\HttpGetActionInterface;
use Magento\Framework\Controller\Result\Json;
use Magento\Framework\Controller\Result\JsonFactory;
use Magento\Framework\Controller\ResultInterface;

/**
 * GET /panthreact/health
 *
 * Returns a minimal JSON status payload so the Astro storefront (or any
 * upstream monitor) can verify the Magento backend is reachable.
 */
class Index implements HttpGetActionInterface
{
    /**
     * Current module version reported in the payload.
     */
    private const MODULE_VERSION = '1.0.0';

    /**
     * @param JsonFactory $jsonFactory
     */
    public function __construct(
        private readonly JsonFactory $jsonFactory
    ) {
    }

    /**
     * Execute the health check action.
     *
     * @return ResultInterface
     */
    public function execute(): ResultInterface
    {
        /** @var Json $result */
        $result = $this->jsonFactory->create();
        $result->setData([
            'ok' => true,
            'version' => self::MODULE_VERSION,
        ]);

        return $result;
    }
}
