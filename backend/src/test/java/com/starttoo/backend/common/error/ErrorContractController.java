package com.starttoo.backend.common.error;

import com.starttoo.backend.common.api.ApiResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/contract")
class ErrorContractController {

    @GetMapping("/success")
    ApiResponse<Payload> success() {
        return ApiResponse.of(new Payload("ok"));
    }

    @PostMapping("/validation")
    ApiResponse<Payload> validation(@Valid @RequestBody Request request) {
        return ApiResponse.of(new Payload(request.value()));
    }

    @GetMapping("/conflict")
    ApiResponse<Boolean> conflict() {
        throw BusinessException.of(ErrorCode.STATE_CONFLICT);
    }

    record Request(@NotBlank String value) {
    }

    record Payload(String value) {
    }
}
