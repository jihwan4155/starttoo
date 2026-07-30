package com.starttoo.backend.ai.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.starttoo.backend.ai.api.AiDtos;
import com.starttoo.backend.common.error.BusinessException;
import com.starttoo.backend.common.error.ErrorCode;
import com.starttoo.backend.media.domain.ImageRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AiService {

    private final ObjectMapper objectMapper;
    private final ImageRepository imageRepository;

    public JsonNode generate(AiDtos.GenerationRequest request) {
        /*
         * TODO(model-integration)
         * AI 생성 서버에 prompt를 전달하고 결과 JSON을 반환한다.
         * 요청·결과 이력은 Starttoo DB에 저장하지 않는다.
         */
        return pendingResponse("GENERATION", null);
    }

    public JsonNode coverup(Integer userSeq, AiDtos.CoverupRequest request) {
        ownedImage(userSeq, request.imageSeq());
        /*
         * TODO(model-integration)
         * 소유 이미지의 MinIO 단기 URL과 prompt를 커버업 모델에 전달한다.
         */
        return pendingResponse("COVERUP", request.imageSeq());
    }

    public JsonNode simulate(Integer userSeq, AiDtos.SimulationRequest request) {
        ownedImage(userSeq, request.bodyImageSeq());
        ownedImage(userSeq, request.tattooImageSeq());
        /*
         * TODO(model-integration)
         * 두 이미지의 MinIO 단기 URL과 배치 파라미터를 시뮬레이션 모델에 전달한다.
         */
        return pendingResponse("SIMULATION", request.tattooImageSeq());
    }

    private JsonNode pendingResponse(String type, Long sourceImageSeq) {
        ObjectNode response = objectMapper.createObjectNode();
        response.put("status", "MODEL_INTEGRATION_PENDING");
        response.put("type", type);
        response.put("mock", true);
        if (sourceImageSeq != null) {
            response.put("sourceImageSeq", sourceImageSeq);
        }
        response.putNull("resultUrl");
        return response;
    }

    private void ownedImage(Integer userSeq, Long imageSeq) {
        imageRepository.findByImageSeqAndDeletedFalse(imageSeq)
                .filter(image -> image.getRegUsrSeq().equals(userSeq))
                .orElseThrow(() -> BusinessException.of(ErrorCode.IMAGE_NOT_FOUND));
    }
}
