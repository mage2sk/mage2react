<?php
/**
 * Panth_React module registration.
 *
 * @copyright Copyright (c) Panth. All rights reserved.
 */
declare(strict_types=1);

use Magento\Framework\Component\ComponentRegistrar;

ComponentRegistrar::register(
    ComponentRegistrar::MODULE,
    'Panth_React',
    __DIR__
);
