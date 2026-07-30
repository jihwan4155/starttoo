package com.starttoo.backend.search.application;

import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class SearchIndexEventPublisher {

    private final ApplicationEventPublisher eventPublisher;

    public void accountChanged(Integer userSeq) {
        eventPublisher.publishEvent(new SearchIndexChangedEvent(
                SearchIndexChangedEvent.TargetType.ACCOUNT,
                userSeq
        ));
    }

    public void subjectChanged(Integer subjectSeq) {
        eventPublisher.publishEvent(new SearchIndexChangedEvent(
                SearchIndexChangedEvent.TargetType.SUBJECT,
                subjectSeq
        ));
    }
}
