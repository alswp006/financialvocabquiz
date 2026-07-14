import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { mockTds } from "@/__tests__/__helpers__/mocks";
import { AppStoreProvider } from "@/store/AppStore";
import Home from "@/pages/Home";

mockTds();

describe("scratch", () => {
  it("renders Home with mocked TDS", () => {
    render(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(AppStoreProvider, null, React.createElement(Home)),
      ),
    );
    expect(true).toBe(true);
  });
});
