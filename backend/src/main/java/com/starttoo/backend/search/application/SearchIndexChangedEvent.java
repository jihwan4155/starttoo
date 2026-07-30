package com.starttoo.backend.search.application;

public record SearchIndexChangedEvent(TargetType targetType, Integer targetSeq) {

    public enum TargetType {
        ACCOUNT,
        SUBJECT
    }
}
